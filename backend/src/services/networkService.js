const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

class NetworkService {
  // Helper: check address conflict
  async checkAddressConflict(trx, ip, mac, currentAllocationId = null) {
    if (ip) {
      const query = trx('ip_allocations')
        .where('ip_address', ip)
        .where('status', 'Active')
        .whereNull('deleted_at')
        .forUpdate();
      if (currentAllocationId) query.whereNot('id', currentAllocationId);
      const existing = await query.first();
      if (existing) {
        throw new Error(`IP Address conflict: ${ip} is already assigned to an active device.`);
      }
    }
    if (mac) {
      const query = trx('ip_allocations')
        .where('mac_address', mac)
        .where('status', 'Active')
        .whereNull('deleted_at')
        .forUpdate();
      if (currentAllocationId) query.whereNot('id', currentAllocationId);
      const existing = await query.first();
      if (existing) {
        throw new Error(`MAC Address conflict: ${mac} is already assigned to an active device.`);
      }
    }
  }

  // ==========================================
  // NETWORK DEVICES (Routers/Switches)
  // ==========================================
  async getAllDevices({ page = 1, limit = 10, search = '', type = '', status = '' }) {
    const query = db('network_devices')
      .leftJoin('ip_allocations', function() {
        this.on('network_devices.id', '=', 'ip_allocations.network_device_id')
          .andOn('ip_allocations.status', '=', db.raw("'Active'"))
          .andOnNull('ip_allocations.deleted_at');
      })
      .select('network_devices.*', 'ip_allocations.ip_address', 'ip_allocations.mac_address', 'ip_allocations.vlan', 'ip_allocations.subnet', 'ip_allocations.gateway', 'ip_allocations.id as allocation_id')
      .whereNull('network_devices.deleted_at');

    if (type) {
      query.where('network_devices.device_type', type);
    }
    if (status) {
      query.where('network_devices.status', status);
    }

    if (search) {
      query.where((builder) => {
        builder.where('network_devices.device_name', 'like', `%${search}%`)
          .orWhere('network_devices.model', 'like', `%${search}%`)
          .orWhere('ip_allocations.ip_address', 'like', `%${search}%`);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('network_devices.device_name', 'asc')
      .limit(limit)
      .offset(offset);

    return {
      devices: data,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getDeviceById(id) {
    const device = await db('network_devices')
      .leftJoin('ip_allocations', function() {
        this.on('network_devices.id', '=', 'ip_allocations.network_device_id')
          .andOn('ip_allocations.status', '=', db.raw("'Active'"))
          .andOnNull('ip_allocations.deleted_at');
      })
      .select('network_devices.*', 'ip_allocations.ip_address', 'ip_allocations.mac_address', 'ip_allocations.vlan', 'ip_allocations.subnet', 'ip_allocations.gateway', 'ip_allocations.id as allocation_id')
      .where('network_devices.id', id)
      .whereNull('network_devices.deleted_at')
      .first();

    return device;
  }

  async createDevice(data, req) {
    const { ip_address, mac_address, vlan, subnet, gateway, ...deviceData } = data;
    let newDevice;

    await db.transaction(async (trx) => {
      // 1. Insert device
      const [deviceId] = await trx('network_devices').insert({
        ...deviceData,
        created_at: new Date(),
        updated_at: new Date()
      });

      // 2. Insert IP allocation if IP is provided
      if (ip_address) {
        await this.checkAddressConflict(trx, ip_address, mac_address);
        await trx('ip_allocations').insert({
          ip_address,
          mac_address: mac_address || null,
          vlan: vlan || null,
          subnet: subnet || null,
          gateway: gateway || null,
          network_device_id: deviceId,
          assignment_type: 'Network Device',
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      newDevice = await trx('network_devices').where('id', deviceId).first();
    });

    const fullDevice = await this.getDeviceById(newDevice.id);
    await logAudit(req, { action: 'Create Network Device', module: 'Network', recordId: fullDevice.id, newValues: fullDevice });
    return fullDevice;
  }

  async updateDevice(id, data, req) {
    const oldDevice = await this.getDeviceById(id);
    if (!oldDevice) return null;

    const { ip_address, mac_address, vlan, subnet, gateway, ...deviceData } = data;

    await db.transaction(async (trx) => {
      // 1. Update device properties
      await trx('network_devices').where('id', id).update({
        ...deviceData,
        updated_at: new Date()
      });

      // 2. Handle IP Allocation Updates
      if (ip_address) {
        await this.checkAddressConflict(trx, ip_address, mac_address, oldDevice.allocation_id);
        
        if (oldDevice.allocation_id) {
          // Update existing active allocation
          await trx('ip_allocations').where('id', oldDevice.allocation_id).update({
            ip_address,
            mac_address: mac_address || null,
            vlan: vlan || null,
            subnet: subnet || null,
            gateway: gateway || null,
            updated_at: new Date()
          });
        } else {
          // Insert new active allocation
          await trx('ip_allocations').insert({
            ip_address,
            mac_address: mac_address || null,
            vlan: vlan || null,
            subnet: subnet || null,
            gateway: gateway || null,
            network_device_id: id,
            assignment_type: 'Network Device',
            status: 'Active',
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      } else if (oldDevice.allocation_id) {
        // Release old allocation if IP is explicitly cleared
        await trx('ip_allocations').where('id', oldDevice.allocation_id).update({
          status: 'Released',
          deleted_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    const fullDevice = await this.getDeviceById(id);
    await logAudit(req, { action: 'Update Network Device', module: 'Network', recordId: id, oldValues: oldDevice, newValues: fullDevice });
    return fullDevice;
  }

  async softDeleteDevice(id, req) {
    const oldDevice = await this.getDeviceById(id);
    if (!oldDevice) return false;

    await db.transaction(async (trx) => {
      // Soft-delete device
      await trx('network_devices').where('id', id).update({
        deleted_at: new Date(),
        updated_at: new Date()
      });

      // Release active allocations
      if (oldDevice.allocation_id) {
        await trx('ip_allocations').where('id', oldDevice.allocation_id).update({
          status: 'Released',
          deleted_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    await logAudit(req, { action: 'Delete Network Device', module: 'Network', recordId: id, oldValues: oldDevice });
    return true;
  }

  // ==========================================
  // WIFI NETWORKS (Access Points)
  // ==========================================
  async getAllWifi({ page = 1, limit = 10, search = '', status = '' }) {
    const query = db('wifi_networks')
      .leftJoin('ip_allocations', function() {
        this.on('wifi_networks.id', '=', 'ip_allocations.wifi_network_id')
          .andOn('ip_allocations.status', '=', db.raw("'Active'"))
          .andOnNull('ip_allocations.deleted_at');
      })
      .select('wifi_networks.*', 'ip_allocations.ip_address', 'ip_allocations.vlan', 'ip_allocations.subnet', 'ip_allocations.gateway', 'ip_allocations.id as allocation_id')
      .whereNull('wifi_networks.deleted_at');

    if (status) {
      query.where('wifi_networks.status', status);
    }

    if (search) {
      query.where((builder) => {
        builder.where('wifi_networks.access_point_name', 'like', `%${search}%`)
          .orWhere('wifi_networks.ssid', 'like', `%${search}%`)
          .orWhere('wifi_networks.building', 'like', `%${search}%`);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('wifi_networks.access_point_name', 'asc')
      .limit(limit)
      .offset(offset);

    return {
      wifiAPs: data,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getWifiById(id) {
    const ap = await db('wifi_networks')
      .leftJoin('ip_allocations', function() {
        this.on('wifi_networks.id', '=', 'ip_allocations.wifi_network_id')
          .andOn('ip_allocations.status', '=', db.raw("'Active'"))
          .andOnNull('ip_allocations.deleted_at');
      })
      .select('wifi_networks.*', 'ip_allocations.ip_address', 'ip_allocations.vlan', 'ip_allocations.subnet', 'ip_allocations.gateway', 'ip_allocations.id as allocation_id')
      .where('wifi_networks.id', id)
      .whereNull('wifi_networks.deleted_at')
      .first();

    return ap;
  }

  async createWifi(data, req) {
    const { ip_address, vlan, subnet, gateway, ...apData } = data;
    let newAP;

    await db.transaction(async (trx) => {
      const [apId] = await trx('wifi_networks').insert({
        ...apData,
        created_at: new Date(),
        updated_at: new Date()
      });

      if (ip_address) {
        await this.checkAddressConflict(trx, ip_address, null);
        await trx('ip_allocations').insert({
          ip_address,
          wifi_network_id: apId,
          assignment_type: 'WiFi AP',
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      newAP = await trx('wifi_networks').where('id', apId).first();
    });

    const fullAP = await this.getWifiById(newAP.id);
    await logAudit(req, { action: 'Create WiFi Access Point', module: 'Network', recordId: fullAP.id, newValues: fullAP });
    return fullAP;
  }

  async updateWifi(id, data, req) {
    const oldAP = await this.getWifiById(id);
    if (!oldAP) return null;

    const { ip_address, vlan, subnet, gateway, ...apData } = data;

    await db.transaction(async (trx) => {
      await trx('wifi_networks').where('id', id).update({
        ...apData,
        updated_at: new Date()
      });

      if (ip_address) {
        await this.checkAddressConflict(trx, ip_address, null, oldAP.allocation_id);
        
        if (oldAP.allocation_id) {
          await trx('ip_allocations').where('id', oldAP.allocation_id).update({
            ip_address,
            updated_at: new Date()
          });
        } else {
          await trx('ip_allocations').insert({
            ip_address,
            wifi_network_id: id,
            assignment_type: 'WiFi AP',
            status: 'Active',
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      } else if (oldAP.allocation_id) {
        await trx('ip_allocations').where('id', oldAP.allocation_id).update({
          status: 'Released',
          deleted_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    const fullAP = await this.getWifiById(id);
    await logAudit(req, { action: 'Update WiFi Access Point', module: 'Network', recordId: id, oldValues: oldAP, newValues: fullAP });
    return fullAP;
  }

  async softDeleteWifi(id, req) {
    const oldAP = await this.getWifiById(id);
    if (!oldAP) return false;

    await db.transaction(async (trx) => {
      await trx('wifi_networks').where('id', id).update({
        deleted_at: new Date(),
        updated_at: new Date()
      });

      if (oldAP.allocation_id) {
        await trx('ip_allocations').where('id', oldAP.allocation_id).update({
          status: 'Released',
          deleted_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    await logAudit(req, { action: 'Delete WiFi Access Point', module: 'Network', recordId: id, oldValues: oldAP });
    return true;
  }

  // ==========================================
  // USER NETWORK ASSIGNMENTS
  // ==========================================
  async getAllAssignments({ page = 1, limit = 10, search = '' }) {
    const query = db('user_network_assignments')
      .join('employees', 'user_network_assignments.employee_id', 'employees.id')
      .leftJoin('assets', 'user_network_assignments.asset_id', 'assets.id')
      .leftJoin('wifi_networks', 'user_network_assignments.access_point_id', 'wifi_networks.id')
      .leftJoin('departments', 'user_network_assignments.department_id', 'departments.id')
      .select(
        'user_network_assignments.*',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as employee_name"),
        'employees.employee_number',
        'assets.name as asset_name',
        'assets.asset_code',
        'wifi_networks.access_point_name',
        'departments.name as department_name'
      );

    if (search) {
      query.where((builder) => {
        builder.where('employees.first_name', 'like', `%${search}%`)
          .orWhere('employees.last_name', 'like', `%${search}%`)
          .orWhere('user_network_assignments.ip_address', 'like', `%${search}%`)
          .orWhere('user_network_assignments.mac_address', 'like', `%${search}%`);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('employees.last_name', 'asc')
      .limit(limit)
      .offset(offset);

    return {
      assignments: data,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getAssignmentById(id) {
    const assignment = await db('user_network_assignments')
      .join('employees', 'user_network_assignments.employee_id', 'employees.id')
      .leftJoin('assets', 'user_network_assignments.asset_id', 'assets.id')
      .leftJoin('wifi_networks', 'user_network_assignments.access_point_id', 'wifi_networks.id')
      .leftJoin('departments', 'user_network_assignments.department_id', 'departments.id')
      .select(
        'user_network_assignments.*',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as employee_name"),
        'employees.employee_number',
        'assets.name as asset_name',
        'assets.asset_code',
        'wifi_networks.access_point_name',
        'departments.name as department_name'
      )
      .where('user_network_assignments.id', id)
      .first();

    return assignment;
  }

  async createAssignment(data, req) {
    const { ip_address, mac_address, vlan, subnet, gateway, switch_id, switch_port, employee_id, asset_id, access_point_id, department_id } = data;
    let newAssign;

    await db.transaction(async (trx) => {
      // 1. Enforce unique active IP/MAC globally
      await this.checkAddressConflict(trx, ip_address, mac_address);

      // 2. Insert main record
      const [assignId] = await trx('user_network_assignments').insert({
        employee_id,
        asset_id: asset_id || null,
        ip_address,
        mac_address,
        switch_port: switch_port || null,
        access_point_id: access_point_id || null,
        department_id: department_id || null,
        created_at: new Date(),
        updated_at: new Date()
      });

      // 3. Register IP Allocation table
      await trx('ip_allocations').insert({
        ip_address,
        mac_address,
        vlan: vlan || null,
        subnet: subnet || null,
        gateway: gateway || null,
        switch_id: switch_id || null,
        switch_port: switch_port || null,
        employee_id, // maps back to employee reference
        asset_id: asset_id || null,
        assignment_type: 'User Assignment',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      });

      // 4. Log change history
      await trx('network_history_logs').insert({
        employee_id,
        asset_id: asset_id || null,
        ip_address,
        mac_address,
        switch_port: switch_port || null,
        action: 'Assign',
        performed_by: req.user.id,
        created_at: new Date()
      });

      newAssign = await trx('user_network_assignments').where('id', assignId).first();
    });

    const fullAssign = await this.getAssignmentById(newAssign.id);
    await logAudit(req, { action: 'Create Network Assignment', module: 'Network', recordId: fullAssign.id, newValues: fullAssign });
    return fullAssign;
  }

  async updateAssignment(id, data, req) {
    const oldAssign = await db('user_network_assignments').where('id', id).first();
    if (!oldAssign) return null;

    const { ip_address, mac_address, vlan, subnet, gateway, switch_id, switch_port, asset_id, access_point_id, department_id } = data;

    await db.transaction(async (trx) => {
      // Find old allocation record
      const oldAlloc = await trx('ip_allocations')
        .where('employee_id', oldAssign.employee_id)
        .where('assignment_type', 'User Assignment')
        .where('status', 'Active')
        .whereNull('deleted_at')
        .first();

      // Check conflict
      await this.checkAddressConflict(trx, ip_address, mac_address, oldAlloc ? oldAlloc.id : null);

      // Update main assignment
      await trx('user_network_assignments').where('id', id).update({
        asset_id: asset_id || oldAssign.asset_id,
        ip_address: ip_address || oldAssign.ip_address,
        mac_address: mac_address || oldAssign.mac_address,
        switch_port: switch_port || oldAssign.switch_port,
        access_point_id: access_point_id || oldAssign.access_point_id,
        department_id: department_id || oldAssign.department_id,
        updated_at: new Date()
      });

      // Update ip_allocations
      if (oldAlloc) {
        await trx('ip_allocations').where('id', oldAlloc.id).update({
          ip_address: ip_address || oldAlloc.ip_address,
          mac_address: mac_address || oldAlloc.mac_address,
          vlan: vlan !== undefined ? vlan : oldAlloc.vlan,
          subnet: subnet !== undefined ? subnet : oldAlloc.subnet,
          gateway: gateway !== undefined ? gateway : oldAlloc.gateway,
          switch_id: switch_id !== undefined ? switch_id : oldAlloc.switch_id,
          switch_port: switch_port !== undefined ? switch_port : oldAlloc.switch_port,
          asset_id: asset_id || oldAlloc.asset_id,
          updated_at: new Date()
        });
      }

      // Record Reassign history
      await trx('network_history_logs').insert({
        employee_id: oldAssign.employee_id,
        asset_id: asset_id || oldAssign.asset_id,
        ip_address: ip_address || oldAssign.ip_address,
        mac_address: mac_address || oldAssign.mac_address,
        switch_port: switch_port || oldAssign.switch_port,
        action: 'Reassign',
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    const fullAssign = await this.getAssignmentById(id);
    await logAudit(req, { action: 'Update Network Assignment', module: 'Network', recordId: id, oldValues: oldAssign, newValues: fullAssign });
    return fullAssign;
  }

  async deleteAssignment(id, req) {
    const oldAssign = await db('user_network_assignments').where('id', id).first();
    if (!oldAssign) return false;

    await db.transaction(async (trx) => {
      // Hard delete user assignment reference
      await trx('user_network_assignments').where('id', id).del();

      // Soft release IP allocation records
      await trx('ip_allocations')
        .where('employee_id', oldAssign.employee_id)
        .where('assignment_type', 'User Assignment')
        .where('status', 'Active')
        .update({
          status: 'Released',
          deleted_at: new Date(),
          updated_at: new Date()
        });

      // Record Release history logs
      await trx('network_history_logs').insert({
        employee_id: oldAssign.employee_id,
        asset_id: oldAssign.asset_id || null,
        ip_address: oldAssign.ip_address,
        mac_address: oldAssign.mac_address,
        switch_port: oldAssign.switch_port || null,
        action: 'Release',
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    await logAudit(req, { action: 'Delete Network Assignment', module: 'Network', recordId: id, oldValues: oldAssign });
    return true;
  }
}

module.exports = new NetworkService();
