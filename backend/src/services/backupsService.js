const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

class BackupsService {
  async getAllBackups({ page = 1, limit = 10, search = '', status = '', type = '', verificationStatus = '', sortBy = 'backup_date', sortOrder = 'desc' }) {
    const query = db('data_backups').whereNull('deleted_at');

    if (status) {
      query.where('status', status);
    }
    if (type) {
      query.where('backup_type', type);
    }
    if (verificationStatus) {
      query.where('verification_status', verificationStatus);
    }

    if (search) {
      query.where((builder) => {
        builder.where('name', 'like', `%${search}%`)
          .orWhere('backup_location', 'like', `%${search}%`);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset(offset);

    return {
      backups: data,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getBackupById(id) {
    const backup = await db('data_backups').where('id', id).whereNull('deleted_at').first();
    return backup;
  }

  async createBackup(data, req) {
    const [id] = await db('data_backups').insert({
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    });

    const newBackup = await this.getBackupById(id);
    await logAudit(req, { action: 'Create Backup', module: 'Backups', recordId: id, newValues: newBackup });
    return newBackup;
  }

  async updateBackup(id, data, req) {
    const oldBackup = await this.getBackupById(id);
    if (!oldBackup) return null;

    await db('data_backups')
      .where('id', id)
      .update({
        ...data,
        updated_at: new Date()
      });

    const newBackup = await this.getBackupById(id);
    await logAudit(req, { action: 'Update Backup', module: 'Backups', recordId: id, oldValues: oldBackup, newValues: newBackup });
    return newBackup;
  }

  async verifyBackup(id, verificationData, req) {
    const oldBackup = await this.getBackupById(id);
    if (!oldBackup) return null;

    await db('data_backups')
      .where('id', id)
      .update({
        verification_status: verificationData.verification_status,
        verified_by_user_id: req.user.id,
        verified_at: new Date(),
        checksum: verificationData.checksum || null,
        restore_test_result: verificationData.restore_test_result,
        retention_until: verificationData.retention_until || null,
        backup_file_count: verificationData.backup_file_count !== undefined ? verificationData.backup_file_count : oldBackup.backup_file_count,
        updated_at: new Date()
      });

    const newBackup = await this.getBackupById(id);
    await logAudit(req, { action: 'Verify Backup', module: 'Backups', recordId: id, oldValues: oldBackup, newValues: newBackup });
    return newBackup;
  }

  async softDeleteBackup(id, req) {
    const oldBackup = await this.getBackupById(id);
    if (!oldBackup) return false;

    await db('data_backups')
      .where('id', id)
      .update({
        deleted_at: new Date(),
        updated_at: new Date()
      });

    await logAudit(req, { action: 'Delete Backup', module: 'Backups', recordId: id, oldValues: oldBackup });
    return true;
  }
}

module.exports = new BackupsService();
