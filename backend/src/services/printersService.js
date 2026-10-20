const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const networkService = require('./networkService'); // Reuse IP allocation conflict checks

class PrintersService {
  async getAllPrinters({ page = 1, limit = 10, search = '', status = '' }) {
    const query = db('printers')
      .leftJoin('departments', 'printers.department_id', 'departments.id')
      .leftJoin('ip_allocations', function() {
        this.on('printers.id', '=', 'ip_allocations.printer_id')
          .andOn('ip_allocations.status', '=', db.raw("'Active'"))
          .andOnNull('ip_allocations.deleted_at');
      })
      .select(
        'printers.*',
        'departments.name as department_name',
        'ip_allocations.ip_address',
        'ip_allocations.mac_address',
        'ip_allocations.vlan',
        'ip_allocations.subnet',
        'ip_allocations.gateway',
        'ip_allocations.id as allocation_id'
      )
      .whereNull('printers.deleted_at');

    if (status) {
      query.where('printers.status', status);
    }

    if (search) {
      query.where((builder) => {
        builder.where('printers.printer_name', 'like', `%${search}%`)
          .orWhere('printers.model', 'like', `%${search}%`)
          .orWhere('ip_allocations.ip_address', 'like', `%${search}%`);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('printers.printer_name', 'asc')
      .limit(limit)
      .offset(offset);

    return {
      printers: data,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getPrinterById(id) {
    const printer = await db('printers')
      .leftJoin('departments', 'printers.department_id', 'departments.id')
      .leftJoin('ip_allocations', function() {
        this.on('printers.id', '=', 'ip_allocations.printer_id')
          .andOn('ip_allocations.status', '=', db.raw("'Active'"))
          .andOnNull('ip_allocations.deleted_at');
      })
      .select(
        'printers.*',
        'departments.name as department_name',
        'ip_allocations.ip_address',
        'ip_allocations.mac_address',
        'ip_allocations.vlan',
        'ip_allocations.subnet',
        'ip_allocations.gateway',
        'ip_allocations.id as allocation_id'
      )
      .where('printers.id', id)
      .whereNull('printers.deleted_at')
      .first();

    return printer;
  }

  async createPrinter(data, req) {
    const { ip_address, mac_address, vlan, subnet, gateway, ...printerData } = data;
    let newPrinter;

    await db.transaction(async (trx) => {
      const [printerId] = await trx('printers').insert({
        ...printerData,
        created_at: new Date(),
        updated_at: new Date()
      });

      if (ip_address) {
        await networkService.checkAddressConflict(trx, ip_address, mac_address);
        await trx('ip_allocations').insert({
          ip_address,
          mac_address: mac_address || null,
          vlan: vlan || null,
          subnet: subnet || null,
          gateway: gateway || null,
          printer_id: printerId,
          assignment_type: 'Printer',
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      newPrinter = await trx('printers').where('id', printerId).first();
    });

    const fullPrinter = await this.getPrinterById(newPrinter.id);
    await logAudit(req, { action: 'Create Printer', module: 'Printers', recordId: fullPrinter.id, newValues: fullPrinter });
    return fullPrinter;
  }

  async updatePrinter(id, data, req) {
    const oldPrinter = await this.getPrinterById(id);
    if (!oldPrinter) return null;

    const { ip_address, mac_address, vlan, subnet, gateway, ...printerData } = data;

    await db.transaction(async (trx) => {
      await trx('printers').where('id', id).update({
        ...printerData,
        updated_at: new Date()
      });

      if (ip_address) {
        await networkService.checkAddressConflict(trx, ip_address, mac_address, oldPrinter.allocation_id);
        
        if (oldPrinter.allocation_id) {
          await trx('ip_allocations').where('id', oldPrinter.allocation_id).update({
            ip_address,
            mac_address: mac_address || null,
            vlan: vlan || null,
            subnet: subnet || null,
            gateway: gateway || null,
            updated_at: new Date()
          });
        } else {
          await trx('ip_allocations').insert({
            ip_address,
            mac_address: mac_address || null,
            vlan: vlan || null,
            subnet: subnet || null,
            gateway: gateway || null,
            printer_id: id,
            assignment_type: 'Printer',
            status: 'Active',
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      } else if (oldPrinter.allocation_id) {
        await trx('ip_allocations').where('id', oldPrinter.allocation_id).update({
          status: 'Released',
          deleted_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    const fullPrinter = await this.getPrinterById(id);
    await logAudit(req, { action: 'Update Printer', module: 'Printers', recordId: id, oldValues: oldPrinter, newValues: fullPrinter });
    return fullPrinter;
  }

  async softDeletePrinter(id, req) {
    const oldPrinter = await this.getPrinterById(id);
    if (!oldPrinter) return false;

    await db.transaction(async (trx) => {
      await trx('printers').where('id', id).update({
        deleted_at: new Date(),
        updated_at: new Date()
      });

      if (oldPrinter.allocation_id) {
        await trx('ip_allocations').where('id', oldPrinter.allocation_id).update({
          status: 'Released',
          deleted_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    await logAudit(req, { action: 'Delete Printer', module: 'Printers', recordId: id, oldValues: oldPrinter });
    return true;
  }

  // ==========================================
  // PRINTER MAPPED USERS
  // ==========================================
  async getPrinterUsers(printerId) {
    return db('printer_user_assignments')
      .join('employees', 'printer_user_assignments.employee_id', 'employees.id')
      .leftJoin('departments', 'employees.department_id', 'departments.id')
      .select(
        'printer_user_assignments.id',
        'printer_user_assignments.employee_id',
        'printer_user_assignments.created_at',
        'employees.first_name',
        'employees.last_name',
        'employees.employee_number',
        'departments.name as department_name'
      )
      .where('printer_user_assignments.printer_id', printerId)
      .orderBy('employees.last_name', 'asc');
  }

  async assignUser(printerId, employeeId, req) {
    const existing = await db('printer_user_assignments')
      .where({ printer_id: printerId, employee_id: employeeId })
      .first();

    if (existing) {
      throw new Error('User is already assigned to this printer.');
    }

    const [id] = await db('printer_user_assignments').insert({
      printer_id: printerId,
      employee_id: employeeId,
      created_at: new Date()
    });

    await logAudit(req, { action: 'Assign Printer User', module: 'Printers', recordId: printerId, newValues: { employee_id: employeeId } });
    return id;
  }

  async removeUser(printerId, employeeId, req) {
    const result = await db('printer_user_assignments')
      .where({ printer_id: printerId, employee_id: employeeId })
      .del();
    
    if (result) {
      await logAudit(req, { action: 'Remove Printer User', module: 'Printers', recordId: printerId, oldValues: { employee_id: employeeId } });
    }
    return result;
  }

  // ==========================================
  // PRINTER MAINTENANCE LOGS
  // ==========================================
  async getPrinterLogs(printerId) {
    return db('printer_maintenance_logs')
      .leftJoin('users', 'printer_maintenance_logs.technician_id', 'users.id')
      .select(
        'printer_maintenance_logs.*',
        'users.username as technician_username'
      )
      .where('printer_maintenance_logs.printer_id', printerId)
      .orderBy('printer_maintenance_logs.action_date', 'desc');
  }

  async createMaintenanceLog(printerId, data, req) {
    const [id] = await db('printer_maintenance_logs').insert({
      printer_id: printerId,
      technician_id: req.user.id,
      action_type: data.action_type,
      action_date: data.action_date,
      parts_replaced: data.parts_replaced || null,
      cost: data.cost || 0,
      findings: data.findings,
      action_performed: data.action_performed,
      next_maintenance_date: data.next_maintenance_date || null,
      attachments_path: data.attachments_path || null,
      created_at: new Date(),
      updated_at: new Date()
    });

    await logAudit(req, { action: 'Create Printer Maintenance Log', module: 'Printers', recordId: printerId, newValues: { action_type: data.action_type } });
    
    // Optionally update printer status to Online if it was in Maintenance
    await db('printers').where('id', printerId).andWhere('status', 'Maintenance Required').update({ status: 'Online', updated_at: new Date() });
    
    return id;
  }
}

module.exports = new PrintersService();
