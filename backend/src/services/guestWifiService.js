const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const { encryptGCM } = require('../utils/encryption');

class GuestWifiService {
  async getAllGuestWifi({ page = 1, limit = 10, search = '', status = '' }) {
    const query = db('guest_wifi_accounts')
      .leftJoin('employees', 'guest_wifi_accounts.requested_by_employee_id', 'employees.id')
      .select(
        'guest_wifi_accounts.*',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as requested_by_name")
      )
      .whereNull('guest_wifi_accounts.deleted_at');

    if (status) {
      query.where('guest_wifi_accounts.status', status);
    }

    if (search) {
      query.where((builder) => {
        builder.where('guest_wifi_accounts.guest_name', 'like', `%${search}%`)
          .orWhere('guest_wifi_accounts.wifi_username', 'like', `%${search}%`);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('guest_wifi_accounts.start_date', 'desc')
      .limit(limit)
      .offset(offset);

    // Mask passwords for standard endpoint retrieval
    const maskedData = data.map(gw => ({
      ...gw,
      wifi_password_masked: gw.wifi_password_ciphertext ? '********' : null,
      wifi_password_ciphertext: undefined,
      wifi_password_iv: undefined,
      wifi_password_tag: undefined,
      wifi_password_version: undefined
    }));

    return {
      guestWifi: maskedData,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getGuestWifiById(id) {
    const gw = await db('guest_wifi_accounts')
      .leftJoin('employees', 'guest_wifi_accounts.requested_by_employee_id', 'employees.id')
      .select(
        'guest_wifi_accounts.*',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as requested_by_name")
      )
      .where('guest_wifi_accounts.id', id)
      .whereNull('guest_wifi_accounts.deleted_at')
      .first();

    if (!gw) return null;

    return {
      ...gw,
      wifi_password_masked: gw.wifi_password_ciphertext ? '********' : null,
      wifi_password_ciphertext: undefined,
      wifi_password_iv: undefined,
      wifi_password_tag: undefined,
      wifi_password_version: undefined
    };
  }

  async createGuestWifi(data, req) {
    const { wifi_password, ...rest } = data;
    const insertObj = {
      ...rest,
      created_at: new Date(),
      updated_at: new Date()
    };

    if (wifi_password) {
      const encrypted = encryptGCM(wifi_password);
      insertObj.wifi_password_ciphertext = encrypted.ciphertext;
      insertObj.wifi_password_iv = encrypted.iv;
      insertObj.wifi_password_tag = encrypted.tag;
      insertObj.wifi_password_version = encrypted.version;
    }

    const [id] = await db('guest_wifi_accounts').insert(insertObj);
    const newGW = await this.getGuestWifiById(id);
    await logAudit(req, { action: 'Create Guest WiFi Account', module: 'GuestWifi', recordId: id, newValues: { guest_name: data.guest_name, wifi_username: data.wifi_username } });
    return newGW;
  }

  async updateGuestWifi(id, data, req) {
    const oldGW = await db('guest_wifi_accounts').where('id', id).first();
    if (!oldGW) return null;

    const { wifi_password, ...rest } = data;
    const updateObj = {
      ...rest,
      updated_at: new Date()
    };

    if (wifi_password) {
      const encrypted = encryptGCM(wifi_password);
      updateObj.wifi_password_ciphertext = encrypted.ciphertext;
      updateObj.wifi_password_iv = encrypted.iv;
      updateObj.wifi_password_tag = encrypted.tag;
      updateObj.wifi_password_version = encrypted.version;
    }

    await db('guest_wifi_accounts').where('id', id).update(updateObj);
    const newGW = await this.getGuestWifiById(id);
    await logAudit(req, { action: 'Update Guest WiFi Account', module: 'GuestWifi', recordId: id, oldValues: { guest_name: oldGW.guest_name, status: oldGW.status }, newValues: { guest_name: data.guest_name, status: data.status } });
    return newGW;
  }

  async softDeleteGuestWifi(id, req) {
    const oldGW = await db('guest_wifi_accounts').where('id', id).first();
    if (!oldGW) return false;

    await db('guest_wifi_accounts').where('id', id).update({
      deleted_at: new Date(),
      updated_at: new Date()
    });

    await logAudit(req, { action: 'Delete Guest WiFi Account', module: 'GuestWifi', recordId: id, oldValues: { guest_name: oldGW.guest_name } });
    return true;
  }
}

module.exports = new GuestWifiService();
