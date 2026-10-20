const db = require('../config/db');
const logger = require('./logger');

/**
 * Synchronize registered IT Assets from `assets` table to `managed_devices` table.
 * Ensures every computer asset in ITMS is remotable in Remote Device Management.
 */
async function syncAssetsToManagedDevices() {
  try {
    const isSqlite = db.client.config.client === 'sqlite3';
    const concatEmpName = isSqlite 
      ? db.raw("(employees.first_name || ' ' || employees.last_name) as employee_name") 
      : db.raw("concat(employees.first_name, ' ', employees.last_name) as employee_name");

    const assets = await db('assets')
      .leftJoin('asset_categories', 'assets.category_id', 'asset_categories.id')
      .leftJoin('employees', 'assets.employee_id', 'employees.id')
      .select(
        'assets.*',
        'asset_categories.name as category_name',
        concatEmpName
      );

    let syncedCount = 0;

    for (const asset of assets) {
      const deviceId = asset.asset_code || `AST-${asset.id}`;
      const deviceName = `${asset.name} (${asset.brand || ''} ${asset.model || ''})`.trim();
      const locationName = asset.current_location || asset.location || 'NKB Main Office';
      const loggedUser = asset.employee_name || 'NKB\\employee';

      const existing = await db('managed_devices')
        .where({ asset_id: asset.id })
        .orWhere({ device_id: deviceId })
        .first();

      const isAssetActive = asset.status !== 'Disposed' && asset.status !== 'Decommissioned';

      if (existing) {
        await db('managed_devices')
          .where({ id: existing.id })
          .update({
            name: deviceName,
            asset_id: asset.id,
            employee_id: asset.employee_id,
            department_id: asset.department_id,
            location: locationName,
            logged_in_user: loggedUser,
            ip_address: asset.ip_address || existing.ip_address || '192.168.137.49',
            mac_address: asset.mac_address || existing.mac_address || '74:56:3C:99:10:10',
            os_name: asset.os_name || existing.os_name || 'Windows 11 Pro 23H2',
            is_online: isAssetActive,
            last_heartbeat: new Date()
          });
      } else {
        await db('managed_devices').insert({
          device_id: deviceId,
          name: deviceName,
          asset_id: asset.id,
          employee_id: asset.employee_id,
          department_id: asset.department_id,
          location: locationName,
          ip_address: asset.ip_address || '192.168.137.49',
          mac_address: asset.mac_address || '74:56:3C:99:10:10',
          os_name: asset.os_name || 'Windows 11 Pro 23H2',
          os_version: '23H2',
          logged_in_user: loggedUser,
          agent_version: 'v1.2.4',
          is_online: isAssetActive,
          remote_access_enabled: true,
          protected_status: false,
          approved_access_mode: 'attended',
          is_simulated: false,
          last_heartbeat: new Date()
        });
      }

      // Also create device capability record if missing
      const existingCap = await db('device_capabilities').where({ device_id: deviceId }).first();
      if (!existingCap) {
        await db('device_capabilities').insert({
          device_id: deviceId,
          desktop: true,
          terminal: true,
          file_transfer: true,
          power: true,
          process_manage: true,
          service_manage: true
        });
      }

      syncedCount++;
    }

    logger.info(`[AssetDeviceSync] Synchronized ${syncedCount} IT Assets to Managed Devices.`);
    return syncedCount;
  } catch (err) {
    logger.error(`[AssetDeviceSync] Sync error: ${err.message}`);
    return 0;
  }
}

module.exports = { syncAssetsToManagedDevices };
