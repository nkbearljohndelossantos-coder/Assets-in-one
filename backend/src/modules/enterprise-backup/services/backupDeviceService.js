const crypto = require('crypto');
const db = require('../../../config/db');
const backupRepository = require('../repositories/backupRepository');
const { appendAuditLog } = require('../security/backupSecurity');

class BackupDeviceService {

  /**
   * Create a one-time short-lived enrollment token (Mandatory Correction #5)
   */
  async createEnrollmentToken({ userId, expiresInHours = 24, maxUses = 1 }, req = {}) {
    const token = 'nkb_tok_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

    const [id] = await db('backup_enrollment_tokens').insert({
      token,
      created_by_user_id: userId || null,
      max_uses: maxUses,
      uses_count: 0,
      expires_at: expiresAt,
      is_revoked: false,
      created_at: new Date(),
      updated_at: new Date()
    });

    await appendAuditLog(db, {
      actorType: 'User',
      actorId: userId || 'system',
      action: 'Create Enrollment Token',
      result: 'Success',
      correlationId: req.correlationId || crypto.randomUUID(),
      metadata: { tokenId: id, token, expiresAt, maxUses }
    });

    return { id, token, expiresAt, maxUses };
  }

  /**
   * Enroll a Windows Backup Agent (Mandatory Correction #5 & #6)
   */
  async enrollAgent(payload, req = {}) {
    const { enrollmentToken, deviceId, deviceName, hostname, ipAddress, macAddress, osVersion, agentVersion, publicKeyPem } = payload;

    return db.transaction(async (trx) => {
      // 1. Validate Token atomically
      const tokenRec = await trx('backup_enrollment_tokens')
        .where({ token: enrollmentToken, is_revoked: false })
        .first();

      if (!tokenRec) {
        throw new Error('ENROLLMENT_TOKEN_INVALID_OR_EXPIRED');
      }

      if (new Date(tokenRec.expires_at) <= new Date()) {
        throw new Error('ENROLLMENT_TOKEN_EXPIRED');
      }

      if (tokenRec.uses_count >= tokenRec.max_uses) {
        throw new Error('ENROLLMENT_TOKEN_USAGE_EXCEEDED');
      }

      // 2. Consume token usage
      await trx('backup_enrollment_tokens')
        .where({ id: tokenRec.id })
        .update({
          uses_count: tokenRec.uses_count + 1,
          updated_at: new Date()
        });

      // 3. Register or update device record
      let existingDevice = await trx('backup_devices').where({ device_id: deviceId }).first();
      let deviceDbId;

      if (existingDevice) {
        deviceDbId = existingDevice.id;
        await trx('backup_devices').where({ id: deviceDbId }).update({
          device_name: deviceName,
          hostname,
          ip_address: ipAddress || existingDevice.ip_address,
          mac_address: macAddress || existingDevice.mac_address,
          os_version: osVersion || existingDevice.os_version,
          agent_version: agentVersion,
          status: 'online',
          last_heartbeat_at: new Date(),
          updated_at: new Date()
        });
      } else {
        const [insertedId] = await trx('backup_devices').insert({
          device_id: deviceId,
          device_name: deviceName,
          hostname,
          ip_address: ipAddress || null,
          mac_address: macAddress || null,
          os_version: osVersion || null,
          agent_version: agentVersion,
          status: 'online',
          last_heartbeat_at: new Date(),
          enrolled_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        });
        deviceDbId = insertedId;
      }

      // 4. Generate device certificate fingerprint & record
      const fingerprint = crypto.createHash('sha256').update(publicKeyPem).digest('hex');
      const expiresAt = new Date(Date.now() + 365 * 86400 * 1000); // 1 year cert credential

      await trx('backup_device_certificates').insert({
        device_id_ref: deviceDbId,
        fingerprint,
        public_key_pem: publicKeyPem,
        status: 'active',
        issued_at: new Date(),
        expires_at: expiresAt,
        created_at: new Date(),
        updated_at: new Date()
      });

      // 5. Issue device credential secret token
      const deviceAuthCredentialToken = crypto.randomBytes(32).toString('hex');

      await appendAuditLog(trx, {
        actorType: 'Agent',
        actorId: deviceId,
        deviceId,
        action: 'Enroll Device',
        result: 'Success',
        correlationId: req.correlationId || crypto.randomUUID(),
        metadata: { deviceDbId, fingerprint, expiresAt }
      });

      return {
        deviceId,
        deviceDbId,
        fingerprint,
        deviceAuthCredentialToken,
        expiresAt
      };
    });
  }

  /**
   * Heartbeat updater (Mandatory Correction #6)
   */
  async processHeartbeat(deviceId, agentVersion, diskInventory = null) {
    const device = await backupRepository.getDeviceByDeviceId(deviceId);
    if (!device) throw new Error('DEVICE_NOT_FOUND');

    await backupRepository.updateDeviceStatus(deviceId, 'online', agentVersion);

    // If disk inventory provided, update disks & volumes
    if (Array.isArray(diskInventory)) {
      await db.transaction(async (trx) => {
        for (const disk of diskInventory) {
          let existingDisk = await trx('backup_device_disks')
            .where({ device_id_ref: device.id, disk_number: disk.diskNumber })
            .first();

          let diskId;
          if (existingDisk) {
            diskId = existingDisk.id;
            await trx('backup_device_disks').where({ id: diskId }).update({
              model: disk.model,
              manufacturer: disk.manufacturer,
              serial_number: disk.serialNumber,
              bus_type: disk.busType,
              capacity_bytes: disk.capacityBytes,
              partition_style: disk.partitionStyle,
              is_boot_disk: disk.isBootDisk || false,
              is_system_disk: disk.isSystemDisk || false,
              smart_health: disk.smartHealth || 'OK',
              updated_at: new Date()
            });
          } else {
            const [newDiskId] = await trx('backup_device_disks').insert({
              device_id_ref: device.id,
              disk_number: disk.diskNumber,
              model: disk.model,
              manufacturer: disk.manufacturer,
              serial_number: disk.serialNumber,
              bus_type: disk.busType,
              capacity_bytes: disk.capacityBytes,
              partition_style: disk.partitionStyle,
              is_boot_disk: disk.isBootDisk || false,
              is_system_disk: disk.isSystemDisk || false,
              smart_health: disk.smartHealth || 'OK',
              created_at: new Date(),
              updated_at: new Date()
            });
            diskId = newDiskId;
          }

          if (Array.isArray(disk.volumes)) {
            for (const vol of disk.volumes) {
              let existingVol = await trx('backup_device_volumes')
                .where({ disk_id_ref: diskId, drive_letter: vol.driveLetter })
                .first();

              if (existingVol) {
                await trx('backup_device_volumes').where({ id: existingVol.id }).update({
                  volume_label: vol.volumeLabel,
                  filesystem: vol.filesystem,
                  total_bytes: vol.totalBytes,
                  free_bytes: vol.freeBytes,
                  is_system_volume: vol.isSystemVolume || false,
                  is_bitlocker_enabled: vol.isBitLockerEnabled || false,
                  updated_at: new Date()
                });
              } else {
                await trx('backup_device_volumes').insert({
                  disk_id_ref: diskId,
                  drive_letter: vol.driveLetter,
                  volume_label: vol.volumeLabel,
                  filesystem: vol.filesystem,
                  total_bytes: vol.totalBytes,
                  free_bytes: vol.freeBytes,
                  is_system_volume: vol.isSystemVolume || false,
                  is_bitlocker_enabled: vol.isBitLockerEnabled || false,
                  created_at: new Date(),
                  updated_at: new Date()
                });
              }
            }
          }
        }
      });
    }

    return { status: 'acknowledged', lastHeartbeatAt: new Date() };
  }
}

module.exports = new BackupDeviceService();
