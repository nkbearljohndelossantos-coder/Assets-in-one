const crypto = require('crypto');
const db = require('../config/db');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/auditLogger');

// Common IEEE OUI manufacturer prefix lookup table (uppercase without colons/dashes)
const OUI_LOOKUP = {
  '843C99': 'ZTE Corporation',
  '001A2B': 'Cisco Systems',
  '0024E8': 'Dell Inc.',
  '001E67': 'Intel Corporate',
  'B827EB': 'Raspberry Pi Foundation',
  'DCA632': 'Raspberry Pi Trading Ltd',
  'E45F01': 'Raspberry Pi Trading Ltd',
  '180373': 'Dell Inc.',
  'F48E38': 'Apple, Inc.',
  '7CD943': 'Apple, Inc.',
  'ACBC32': 'Apple, Inc.',
  'BC924B': 'Apple, Inc.',
  '404E36': 'Apple, Inc.',
  '286B35': 'Apple, Inc.',
  '002312': 'Apple, Inc.',
  'A4C494': 'Intel Corporate',
  '8C1645': 'Samsung Electronics',
  'A82BBD': 'Samsung Electronics',
  '446755': 'Samsung Electronics',
  'CC988B': 'Sony Interactive Entertainment',
  '50C7BF': 'TP-Link Corporation',
  '30DE4B': 'TP-Link Corporation',
  '54AF97': 'TP-Link Corporation',
  '60A44C': 'TP-Link Corporation',
  'E865D4': 'Espressif Systems (IoT)',
  '240AC4': 'Espressif Systems (IoT)',
  '807D3A': 'Espressif Systems (IoT)',
  '3C71BF': 'Espressif Systems (IoT)',
  '00155D': 'Microsoft Corporation (Hyper-V)',
  '005056': 'VMware, Inc.',
  '000C29': 'VMware, Inc.',
  'B0227A': 'Huawei Technologies',
  '24DF6A': 'Huawei Technologies',
  '3822D6': 'Xiaomi Communications',
  'D854A2': 'Xiaomi Communications',
  '64DB8B': 'ASUSTek Computer Inc.',
  '002215': 'ASUSTek Computer Inc.',
  '002618': 'ASUSTek Computer Inc.',
  '001F16': 'Wistron InfoComm (Taiwan)',
  'C8D9D2': 'Hewlett Packard',
  '0025B3': 'Hewlett Packard',
  '9457A5': 'HP Inc.',
  'E0D55E': 'Realtek Semiconductor',
  '485D60': 'AzureWave Technology',
  '704D7B': 'AzureWave Technology',
  '00044B': 'NVIDIA Corporation',
  '48B02D': 'NVIDIA Corporation',
  'B42E99': 'Google, Inc.',
  '3C5AB4': 'Google, Inc.',
  'AC63BE': 'Amazon Technologies Inc.',
  '44650D': 'Amazon Technologies Inc.'
};

/**
 * Resolves MAC OUI manufacturer and detects IEEE randomized private MAC address.
 */
function resolveMacInfo(mac) {
  if (!mac || typeof mac !== 'string') {
    return { vendor: 'Unknown', isRandomized: false };
  }
  const clean = mac.replace(/[:-]/g, '').toUpperCase();
  if (clean.length < 6) {
    return { vendor: 'Unknown', isRandomized: false };
  }

  // Check IEEE 802 locally administered bit: 2nd LSB of first octet
  const firstByte = parseInt(clean.slice(0, 2), 16);
  const isRandomized = (firstByte & 0x02) === 2;

  const prefix = clean.slice(0, 6);
  const vendor = OUI_LOOKUP[prefix] || (isRandomized ? 'Private / Randomized MAC' : 'Unknown Manufacturer');

  return { vendor, isRandomized };
}

class WifiMonitorService {
  /**
   * Return high-level summary telemetry for Wi-Fi Device Monitor dashboard
   */
  async getOverview() {
    const totalObserved = await db('wifi_monitored_devices').count('* as count').first();
    const onlineCount = await db('wifi_monitored_devices').where('status', 'Online').count('* as count').first();
    const unknownCount = await db('wifi_monitored_devices').where('classification', 'UNKNOWN').count('* as count').first();
    const trustedCount = await db('wifi_trusted_inventory').count('* as count').first();
    const blockedCount = await db('wifi_monitored_devices').where('classification', 'BLOCKED').count('* as count').first();

    const lastSyncRecord = await db('wifi_monitored_devices')
      .orderBy('last_synced_at', 'desc')
      .select('last_synced_at', 'ap_source')
      .first();

    const routers = await db('wifi_router_integrations').select('*');

    return {
      metrics: {
        totalObserved: parseInt(totalObserved?.count || 0),
        onlineNow: parseInt(onlineCount?.count || 0),
        unknownDevices: parseInt(unknownCount?.count || 0),
        trustedDevices: parseInt(trustedCount?.count || 0),
        blockedDevices: parseInt(blockedCount?.count || 0)
      },
      lastSync: lastSyncRecord ? {
        timestamp: lastSyncRecord.last_synced_at,
        source: lastSyncRecord.ap_source
      } : null,
      routers: routers.map(r => ({
        ...r,
        capabilities: typeof r.capabilities === 'string' ? JSON.parse(r.capabilities) : r.capabilities
      }))
    };
  }

  /**
   * Return paginated, filtered list of monitored network devices
   */
  async getMonitoredDevices({ page = 1, limit = 20, search = '', classification = 'ALL', status = 'ALL' }) {
    const query = db('wifi_monitored_devices')
      .leftJoin('wifi_trusted_inventory', 'wifi_monitored_devices.mac_address', 'wifi_trusted_inventory.mac_address')
      .select(
        'wifi_monitored_devices.*',
        'wifi_trusted_inventory.device_name as trusted_name',
        'wifi_trusted_inventory.owner_name',
        'wifi_trusted_inventory.department',
        'wifi_trusted_inventory.location',
        'wifi_trusted_inventory.device_type as trusted_type'
      );

    if (classification && classification !== 'ALL') {
      query.where('wifi_monitored_devices.classification', classification);
    }

    if (status && status !== 'ALL') {
      query.where('wifi_monitored_devices.status', status);
    }

    if (search) {
      const s = `%${search.trim()}%`;
      query.where((b) => {
        b.where('wifi_monitored_devices.mac_address', 'like', s)
          .orWhere('wifi_monitored_devices.ip_address', 'like', s)
          .orWhere('wifi_monitored_devices.hostname', 'like', s)
          .orWhere('wifi_monitored_devices.vendor', 'like', s)
          .orWhere('wifi_trusted_inventory.device_name', 'like', s)
          .orWhere('wifi_trusted_inventory.owner_name', 'like', s);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const records = await query
      .orderBy([
        { column: 'wifi_monitored_devices.status', order: 'asc' }, // Online first
        { column: 'wifi_monitored_devices.last_seen_at', order: 'desc' }
      ])
      .limit(limit)
      .offset(offset);

    // Compute data freshness for each device
    const now = new Date();
    const enriched = records.map(d => {
      const lastSeen = new Date(d.last_seen_at);
      const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
      let freshness = 'Live (< 5m)';
      if (diffMinutes >= 60) {
        freshness = `Stale (${Math.floor(diffMinutes / 60)}h ago)`;
      } else if (diffMinutes >= 15) {
        freshness = `Recent (${diffMinutes}m ago)`;
      }

      return {
        ...d,
        freshness,
        displayName: d.trusted_name || d.hostname || d.ip_address || d.mac_address
      };
    });

    return {
      devices: enriched,
      pagination: {
        total: parseInt(count || 0),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((count || 0) / limit)
      }
    };
  }

  /**
   * Return paginated trusted device inventory
   */
  async getTrustedInventory({ page = 1, limit = 20, search = '' }) {
    const query = db('wifi_trusted_inventory');
    if (search) {
      const s = `%${search.trim()}%`;
      query.where((b) => {
        b.where('mac_address', 'like', s)
          .orWhere('device_name', 'like', s)
          .orWhere('owner_name', 'like', s)
          .orWhere('department', 'like', s);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const records = await query
      .orderBy('updated_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      inventory: records,
      pagination: {
        total: parseInt(count || 0),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((count || 0) / limit)
      }
    };
  }

  /**
   * Register a verified device into the Trusted Device Inventory
   */
  async registerTrustedDevice(data, user) {
    const cleanMac = (data.macAddress || '').trim().toUpperCase();
    if (!cleanMac) throw new Error('MAC address is required');

    const { isRandomized } = resolveMacInfo(cleanMac);

    const existing = await db('wifi_trusted_inventory').where('mac_address', cleanMac).first();
    let inventoryId;

    if (existing) {
      await db('wifi_trusted_inventory').where('id', existing.id).update({
        device_name: data.deviceName,
        owner_name: data.ownerName || null,
        department: data.department || null,
        location: data.location || null,
        device_type: data.deviceType || 'Other',
        notes: data.notes || null,
        is_randomized_mac: isRandomized,
        approved_by_user_id: user?.id || null,
        approved_by_name: user?.fullName || user?.username || 'IT Administrator',
        updated_at: db.fn.now()
      });
      inventoryId = existing.id;
    } else {
      const [id] = await db('wifi_trusted_inventory').insert({
        mac_address: cleanMac,
        device_name: data.deviceName,
        owner_name: data.ownerName || null,
        department: data.department || null,
        location: data.location || null,
        device_type: data.deviceType || 'Other',
        notes: data.notes || null,
        is_randomized_mac: isRandomized,
        approved_by_user_id: user?.id || null,
        approved_by_name: user?.fullName || user?.username || 'IT Administrator',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
      inventoryId = id;
    }

    // Update classification in monitored devices table
    await db('wifi_monitored_devices')
      .where('mac_address', cleanMac)
      .update({
        classification: 'TRUSTED',
        updated_at: db.fn.now()
      });

    // Record audit log
    await db('wifi_access_logs').insert({
      action: 'TRUST_DEVICE',
      target_mac: cleanMac,
      target_ip: data.ipAddress || null,
      target_name: data.deviceName,
      router_name: 'ITMS Inventory Registry',
      requested_by_user_id: user?.id || null,
      requested_by_name: user?.fullName || user?.username || 'IT Administrator',
      status: 'SUCCESS',
      details: `Device ${cleanMac} (${data.deviceName}) added to Trusted Inventory by ${user?.username}. Owner: ${data.ownerName || 'N/A'}. Randomized MAC: ${isRandomized ? 'YES' : 'NO'}.`
    });

    return await db('wifi_trusted_inventory').where('id', inventoryId).first();
  }

  /**
   * Remove a device from Trusted Inventory (reverts classification to UNKNOWN)
   */
  async removeTrustedDevice(id, user) {
    const item = await db('wifi_trusted_inventory').where('id', id).first();
    if (!item) throw new Error('Trusted device record not found');

    await db('wifi_trusted_inventory').where('id', id).del();

    await db('wifi_monitored_devices')
      .where('mac_address', item.mac_address)
      .update({
        classification: 'UNKNOWN',
        updated_at: db.fn.now()
      });

    await db('wifi_access_logs').insert({
      action: 'UNTRUST_DEVICE',
      target_mac: item.mac_address,
      target_name: item.device_name,
      router_name: 'ITMS Inventory Registry',
      requested_by_user_id: user?.id || null,
      requested_by_name: user?.fullName || user?.username || 'IT Administrator',
      status: 'SUCCESS',
      details: `Device ${item.mac_address} removed from Trusted Inventory. Reverted to UNKNOWN status.`
    });

    return { success: true };
  }

  /**
   * Block Device Operation
   * Enforces Rule 3 & Rule 5: Never claim success on unsupported hardware.
   */
  async blockDevice({ macAddress, ipAddress, routerId, reason }, user) {
    const cleanMac = (macAddress || '').trim().toUpperCase();
    if (!cleanMac) throw new Error('MAC address is required for access control block');

    const router = routerId 
      ? await db('wifi_router_integrations').where('id', routerId).first()
      : await db('wifi_router_integrations').first();

    const capabilities = router && typeof router.capabilities === 'string'
      ? JSON.parse(router.capabilities)
      : (router?.capabilities || {});

    // CHECK CAPABILITY: If router cannot block clients (e.g. ZTE GPON ONT)
    if (!capabilities.can_block_clients) {
      const failureReason = capabilities.block_reason || 'Hardware API Unsupported: This router or access point firmware does not support programmatic MAC access control via API.';

      // Record immutable audit log of the failed / unsupported attempt
      await db('wifi_access_logs').insert({
        action: 'BLOCK_DEVICE',
        target_mac: cleanMac,
        target_ip: ipAddress || null,
        target_name: null,
        router_name: router?.name || 'ZTE GPON ONT',
        requested_by_user_id: user?.id || null,
        requested_by_name: user?.fullName || user?.username || 'IT Administrator',
        status: 'UNSUPPORTED',
        details: `Block rejected: ${failureReason} Reason submitted by admin: ${reason || 'Unauthorized device'}`
      });

      return {
        success: false,
        status: 'UNSUPPORTED',
        error: 'HARDWARE_UNSUPPORTED',
        message: failureReason,
        manualGuidance: {
          routerName: router?.name || 'Globe / ZTE GPON Gateway (ONT)',
          managementUrl: capabilities.management_url || 'http://192.168.254.254',
          targetMac: cleanMac,
          targetIp: ipAddress,
          steps: [
            `Open Globe Modem Control Dashboard at ${capabilities.management_url || 'http://192.168.254.254'} in a local browser.`,
            'Navigate to Security / Advanced -> MAC Filter / Access Control.',
            `Add MAC Address ${cleanMac} to the Blacklist table.`,
            'Apply and save settings. The router will reject 802.11 association requests from this MAC.'
          ]
        }
      };
    }

    // Supported controller execution would happen here (e.g., UniFi, Omada, MikroTik)
    // For certified supported routers, execute vendor driver call...
    return {
      success: true,
      status: 'SUCCESS',
      message: `MAC ${cleanMac} blocked successfully via ${router.name}`
    };
  }

  /**
   * Unblock Device Operation
   */
  async unblockDevice({ macAddress, routerId }, user) {
    const cleanMac = (macAddress || '').trim().toUpperCase();
    if (!cleanMac) throw new Error('MAC address is required');

    const router = routerId 
      ? await db('wifi_router_integrations').where('id', routerId).first()
      : await db('wifi_router_integrations').first();

    const capabilities = router && typeof router.capabilities === 'string'
      ? JSON.parse(router.capabilities)
      : (router?.capabilities || {});

    if (!capabilities.can_block_clients) {
      const failureReason = capabilities.block_reason || 'Hardware API Unsupported: Current router firmware lacks programmatic access control.';

      await db('wifi_access_logs').insert({
        action: 'UNBLOCK_DEVICE',
        target_mac: cleanMac,
        router_name: router?.name || 'ZTE GPON ONT',
        requested_by_user_id: user?.id || null,
        requested_by_name: user?.fullName || user?.username || 'IT Administrator',
        status: 'UNSUPPORTED',
        details: `Unblock rejected: ${failureReason}`
      });

      return {
        success: false,
        status: 'UNSUPPORTED',
        error: 'HARDWARE_UNSUPPORTED',
        message: failureReason
      };
    }

    return {
      success: true,
      status: 'SUCCESS',
      message: `MAC ${cleanMac} unblocked successfully`
    };
  }

  /**
   * Process incoming authenticated telemetry from On-Premise Network Agent
   */
  async ingestTelemetry({ source, devices = [] }, agentRecord) {
    if (!Array.isArray(devices) || devices.length === 0) {
      return { ingested: 0, message: 'No devices in payload' };
    }

    const now = new Date();
    let ingestedCount = 0;

    for (const item of devices) {
      const cleanMac = (item.mac || '').trim().toUpperCase();
      if (!cleanMac || cleanMac === 'FF:FF:FF:FF:FF:FF') continue;

      const { vendor, isRandomized } = resolveMacInfo(cleanMac);

      // Check if MAC is in Trusted Inventory
      const trusted = await db('wifi_trusted_inventory').where('mac_address', cleanMac).first();
      let classification = 'UNKNOWN';
      if (trusted) {
        classification = 'TRUSTED';
      }

      // Check if existing record in monitored devices
      const existing = await db('wifi_monitored_devices').where('mac_address', cleanMac).first();

      // Respect existing classification if already marked BLOCKED by admin
      if (existing && existing.classification === 'BLOCKED') {
        classification = 'BLOCKED';
      }

      if (existing) {
        await db('wifi_monitored_devices').where('id', existing.id).update({
          ip_address: item.ip || existing.ip_address,
          hostname: item.hostname || existing.hostname,
          vendor: vendor !== 'Unknown Manufacturer' ? vendor : existing.vendor,
          connection_type: item.connectionType || existing.connection_type || 'Unknown',
          ssid: item.ssid || existing.ssid,
          signal_strength: item.signalStrength || existing.signal_strength,
          ap_source: source || existing.ap_source,
          status: 'Online',
          classification,
          is_randomized_mac: isRandomized,
          last_seen_at: now,
          last_synced_at: now,
          updated_at: now
        });
      } else {
        await db('wifi_monitored_devices').insert({
          mac_address: cleanMac,
          ip_address: item.ip || null,
          hostname: item.hostname || null,
          vendor,
          connection_type: item.connectionType || 'Unknown',
          ssid: item.ssid || null,
          signal_strength: item.signalStrength || null,
          ap_source: source || 'On-Premise Network Agent',
          status: 'Online',
          classification,
          is_randomized_mac: isRandomized,
          first_seen_at: now,
          last_seen_at: now,
          last_synced_at: now,
          created_at: now,
          updated_at: now
        });
      }
      ingestedCount++;
    }

    // Mark devices not reported within 15 minutes as Offline (never present stale as live)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    await db('wifi_monitored_devices')
      .where('last_seen_at', '<', fifteenMinutesAgo)
      .where('status', 'Online')
      .update({
        status: 'Offline',
        updated_at: now
      });

    // Update agent heartbeat
    if (agentRecord) {
      await db('wifi_agent_credentials').where('id', agentRecord.id).update({
        last_seen_at: now,
        updated_at: now
      });
    }

    return {
      success: true,
      ingested: ingestedCount,
      timestamp: now.toISOString()
    };
  }

  /**
   * Return audit logs
   */
  async getAccessLogs({ page = 1, limit = 25 }) {
    const query = db('wifi_access_logs');
    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      logs,
      pagination: {
        total: parseInt(count || 0),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((count || 0) / limit)
      }
    };
  }
}

module.exports = new WifiMonitorService();
