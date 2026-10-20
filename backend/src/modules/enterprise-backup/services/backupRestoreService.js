const crypto = require('crypto');
const db = require('../../../config/db');
const backupRepository = require('../repositories/backupRepository');
const { appendAuditLog } = require('../security/backupSecurity');

class BackupRestoreService {

  /**
   * Authorize a file-level restore job (Mandatory Correction #17)
   */
  async authorizeRestore(payload, req = {}) {
    const { restorePointId, targetDeviceId, targetDirectory, conflictOption } = payload;

    const restorePoint = await db('backup_restore_points').where({ id: restorePointId }).first();
    if (!restorePoint) throw new Error('RESTORE_POINT_NOT_FOUND');

    const device = await backupRepository.getDeviceById(targetDeviceId);
    if (!device) throw new Error('TARGET_DEVICE_NOT_FOUND');

    const restoreCode = 'RST-' + crypto.randomBytes(6).toString('hex').toUpperCase();

    return db.transaction(async (trx) => {
      const [restoreJobId] = await trx('backup_restore_jobs').insert({
        restore_code: restoreCode,
        restore_point_id: restorePointId,
        target_device_id: targetDeviceId,
        authorized_by_user_id: req.user?.id || 1,
        restore_type: 'FileLevel',
        target_directory: targetDirectory,
        conflict_option: conflictOption || 'Overwrite',
        status: 'Authorized',
        files_restored: 0,
        bytes_restored: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      await appendAuditLog(trx, {
        actorType: 'User',
        actorId: req.user?.id || 'system',
        deviceId: device.device_id,
        action: 'Authorize File Restore',
        result: 'Success',
        correlationId: req.correlationId || crypto.randomUUID(),
        metadata: { restoreJobId, restoreCode, restorePointId, targetDeviceId, targetDirectory }
      });

      const manifest = await trx('backup_manifests').where({ restore_point_id: restorePointId }).first();
      const chunks = await trx('backup_chunks').where({ restore_point_id: restorePointId }).orderBy('chunk_index', 'asc');
      const repository = await backupRepository.getRepositoryById(restorePoint.repository_id);

      return {
        restoreJobId,
        restoreCode,
        targetDeviceId: device.device_id,
        targetDirectory,
        conflictOption,
        manifest: manifest ? {
          manifestRelPath: manifest.manifest_rel_path,
          manifestSha256: manifest.manifest_sha256,
          encryptedDekB64: manifest.encrypted_dek_b64,
          dekKeyRef: manifest.dek_key_ref
        } : null,
        chunksCount: chunks.length,
        repository: {
          id: repository.id,
          name: repository.name,
          type: repository.type,
          targetPath: repository.target_path
        }
      };
    });
  }
}

module.exports = new BackupRestoreService();
