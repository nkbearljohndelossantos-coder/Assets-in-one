const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

class FileSharesService {
  async getAllFileShares({ page = 1, limit = 10, search = '' }) {
    const query = db('file_shares')
      .leftJoin('employees', 'file_shares.owner_employee_id', 'employees.id')
      .select(
        'file_shares.*',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as owner_name")
      )
      .whereNull('file_shares.deleted_at');

    if (search) {
      query.where((builder) => {
        builder.where('file_shares.folder_name', 'like', `%${search}%`)
          .orWhere('file_shares.server_location', 'like', `%${search}%`);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('file_shares.folder_name', 'asc')
      .limit(limit)
      .offset(offset);

    return {
      fileShares: data,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getFileShareById(id) {
    return db('file_shares')
      .leftJoin('employees', 'file_shares.owner_employee_id', 'employees.id')
      .select(
        'file_shares.*',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as owner_name")
      )
      .where('file_shares.id', id)
      .whereNull('file_shares.deleted_at')
      .first();
  }

  async createFileShare(data, req) {
    const [id] = await db('file_shares').insert({
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    });

    const newShare = await this.getFileShareById(id);
    await logAudit(req, { action: 'Create File Share', module: 'FileShares', recordId: id, newValues: newShare });
    return newShare;
  }

  async updateFileShare(id, data, req) {
    const oldShare = await this.getFileShareById(id);
    if (!oldShare) return null;

    await db('file_shares').where('id', id).update({
      ...data,
      updated_at: new Date()
    });

    const newShare = await this.getFileShareById(id);
    await logAudit(req, { action: 'Update File Share', module: 'FileShares', recordId: id, oldValues: oldShare, newValues: newShare });
    return newShare;
  }

  async softDeleteFileShare(id, req) {
    const oldShare = await this.getFileShareById(id);
    if (!oldShare) return false;

    await db('file_shares').where('id', id).update({
      deleted_at: new Date(),
      updated_at: new Date()
    });

    await logAudit(req, { action: 'Delete File Share', module: 'FileShares', recordId: id, oldValues: oldShare });
    return true;
  }

  // ==========================================
  // FILE SHARE PERMISSIONS
  // ==========================================
  async getPermissions(fileShareId) {
    return db('file_share_permissions')
      .leftJoin('employees', 'file_share_permissions.employee_id', 'employees.id')
      .leftJoin('departments', 'file_share_permissions.department_id', 'departments.id')
      .select(
        'file_share_permissions.*',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as employee_name"),
        'departments.name as department_name'
      )
      .where('file_share_permissions.file_share_id', fileShareId)
      .orderBy('file_share_permissions.created_at', 'desc');
  }

  async createPermission(fileShareId, data, req) {
    // Check if exactly this mapping exists
    const query = db('file_share_permissions').where('file_share_id', fileShareId);
    if (data.employee_id) query.where('employee_id', data.employee_id);
    if (data.department_id) query.where('department_id', data.department_id);
    const existing = await query.first();

    if (existing) {
      throw new Error('Permission mapping already exists for this target.');
    }

    const [id] = await db('file_share_permissions').insert({
      file_share_id: fileShareId,
      employee_id: data.employee_id || null,
      department_id: data.department_id || null,
      access_level: data.access_level,
      created_at: new Date()
    });

    await logAudit(req, { action: 'Assign File Share Permission', module: 'FileShares', recordId: fileShareId, newValues: data });
    return id;
  }

  async removePermission(id, req) {
    const oldPerm = await db('file_share_permissions').where('id', id).first();
    if (!oldPerm) return false;

    await db('file_share_permissions').where('id', id).del();
    await logAudit(req, { action: 'Remove File Share Permission', module: 'FileShares', recordId: oldPerm.file_share_id, oldValues: oldPerm });
    return true;
  }
}

module.exports = new FileSharesService();
