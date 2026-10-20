const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const { encryptGCM } = require('../utils/encryption');

class EndpointsService {
  // ==========================================
  // OPERATING SYSTEMS SERVICES
  // ==========================================
  async getAllOS({ page = 1, limit = 10, search = '', activationStatus = '' }) {
    const query = db('operating_systems')
      .join('assets', 'operating_systems.asset_id', 'assets.id')
      .select('operating_systems.*', 'assets.name as asset_name', 'assets.asset_code', 'assets.serial_number');

    if (activationStatus) {
      query.where('operating_systems.activation_status', activationStatus);
    }

    if (search) {
      query.where((builder) => {
        builder.where('operating_systems.edition', 'like', `%${search}%`)
          .orWhere('assets.name', 'like', `%${search}%`)
          .orWhere('assets.asset_code', 'like', `%${search}%`)
          .orWhere('assets.serial_number', 'like', `%${search}%`);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('operating_systems.edition', 'asc')
      .limit(limit)
      .offset(offset);

    // Mask product keys
    const maskedData = data.map(os => ({
      ...os,
      product_key_masked: os.product_key_ciphertext ? 'OS-XXXX-XXXX-XXXX' : null,
      product_key_ciphertext: undefined,
      product_key_iv: undefined,
      product_key_tag: undefined,
      product_key_version: undefined
    }));

    return {
      operatingSystems: maskedData,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getOSById(id) {
    const os = await db('operating_systems')
      .join('assets', 'operating_systems.asset_id', 'assets.id')
      .select('operating_systems.*', 'assets.name as asset_name', 'assets.asset_code', 'assets.serial_number')
      .where('operating_systems.id', id)
      .whereNull('assets.deleted_at')
      .first();

    if (!os) return null;

    return {
      ...os,
      product_key_masked: os.product_key_ciphertext ? 'OS-XXXX-XXXX-XXXX' : null,
      product_key_ciphertext: undefined,
      product_key_iv: undefined,
      product_key_tag: undefined,
      product_key_version: undefined
    };
  }

  async createOS(data, req) {
    const { product_key, ...rest } = data;
    const insertObj = {
      ...rest,
      last_activation_check_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    if (product_key) {
      const encrypted = encryptGCM(product_key);
      insertObj.product_key_ciphertext = encrypted.ciphertext;
      insertObj.product_key_iv = encrypted.iv;
      insertObj.product_key_tag = encrypted.tag;
      insertObj.product_key_version = encrypted.version;
    }

    const [id] = await db('operating_systems').insert(insertObj);
    const newOS = await this.getOSById(id);
    await logAudit(req, { action: 'Create OS Record', module: 'Endpoints', recordId: id, newValues: { edition: data.edition } });
    return newOS;
  }

  async updateOS(id, data, req) {
    const oldOS = await db('operating_systems').where('id', id).first();
    if (!oldOS) return null;

    const { product_key, ...rest } = data;
    const updateObj = {
      ...rest,
      last_activation_check_at: new Date(),
      updated_at: new Date()
    };

    if (product_key) {
      const encrypted = encryptGCM(product_key);
      updateObj.product_key_ciphertext = encrypted.ciphertext;
      updateObj.product_key_iv = encrypted.iv;
      updateObj.product_key_tag = encrypted.tag;
      updateObj.product_key_version = encrypted.version;
    }

    await db('operating_systems').where('id', id).update(updateObj);
    const newOS = await this.getOSById(id);
    await logAudit(req, { action: 'Update OS Record', module: 'Endpoints', recordId: id, oldValues: { edition: oldOS.edition }, newValues: { edition: data.edition } });
    return newOS;
  }

  async deleteOS(id, req) {
    const oldOS = await db('operating_systems').where('id', id).first();
    if (!oldOS) return false;

    await db('operating_systems').where('id', id).del();
    await logAudit(req, { action: 'Delete OS Record', module: 'Endpoints', recordId: id, oldValues: { edition: oldOS.edition } });
    return true;
  }

  // ==========================================
  // ANTIVIRUS SERVICES
  // ==========================================
  async getAllAntivirus({ page = 1, limit = 10, search = '', scanResult = '' }) {
    const query = db('antivirus_tracking')
      .join('assets', 'antivirus_tracking.asset_id', 'assets.id')
      .select('antivirus_tracking.*', 'assets.name as asset_name', 'assets.asset_code', 'assets.serial_number');

    if (scanResult) {
      query.where('antivirus_tracking.scan_result', scanResult);
    }

    if (search) {
      query.where((builder) => {
        builder.where('antivirus_tracking.antivirus_name', 'like', `%${search}%`)
          .orWhere('assets.name', 'like', `%${search}%`)
          .orWhere('assets.asset_code', 'like', `%${search}%`);
      });
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('antivirus_tracking.antivirus_name', 'asc')
      .limit(limit)
      .offset(offset);

    // Mask antivirus keys
    const maskedData = data.map(av => ({
      ...av,
      license_key_masked: av.license_key_ciphertext ? 'AV-XXXX-XXXX-XXXX' : null,
      license_key_ciphertext: undefined,
      license_key_iv: undefined,
      license_key_tag: undefined,
      license_key_version: undefined
    }));

    return {
      antivirusList: maskedData,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getAntivirusById(id) {
    const av = await db('antivirus_tracking')
      .join('assets', 'antivirus_tracking.asset_id', 'assets.id')
      .select('antivirus_tracking.*', 'assets.name as asset_name', 'assets.asset_code', 'assets.serial_number')
      .where('antivirus_tracking.id', id)
      .whereNull('assets.deleted_at')
      .first();

    if (!av) return null;

    return {
      ...av,
      license_key_masked: av.license_key_ciphertext ? 'AV-XXXX-XXXX-XXXX' : null,
      license_key_ciphertext: undefined,
      license_key_iv: undefined,
      license_key_tag: undefined,
      license_key_version: undefined
    };
  }

  async createAntivirus(data, req) {
    const { license_key, ...rest } = data;
    const insertObj = {
      ...rest,
      created_at: new Date(),
      updated_at: new Date()
    };

    if (license_key) {
      const encrypted = encryptGCM(license_key);
      insertObj.license_key_ciphertext = encrypted.ciphertext;
      insertObj.license_key_iv = encrypted.iv;
      insertObj.license_key_tag = encrypted.tag;
      insertObj.license_key_version = encrypted.version;
    }

    const [id] = await db('antivirus_tracking').insert(insertObj);
    const newAV = await this.getAntivirusById(id);
    await logAudit(req, { action: 'Create Antivirus Record', module: 'Endpoints', recordId: id, newValues: { antivirus_name: data.antivirus_name } });
    return newAV;
  }

  async updateAntivirus(id, data, req) {
    const oldAV = await db('antivirus_tracking').where('id', id).first();
    if (!oldAV) return null;

    const { license_key, ...rest } = data;
    const updateObj = {
      ...rest,
      updated_at: new Date()
    };

    if (license_key) {
      const encrypted = encryptGCM(license_key);
      updateObj.license_key_ciphertext = encrypted.ciphertext;
      updateObj.license_key_iv = encrypted.iv;
      updateObj.license_key_tag = encrypted.tag;
      updateObj.license_key_version = encrypted.version;
    }

    await db('antivirus_tracking').where('id', id).update(updateObj);
    const newAV = await this.getAntivirusById(id);
    await logAudit(req, { action: 'Update Antivirus Record', module: 'Endpoints', recordId: id, oldValues: { antivirus_name: oldAV.antivirus_name }, newValues: { antivirus_name: data.antivirus_name } });
    return newAV;
  }

  async deleteAntivirus(id, req) {
    const oldAV = await db('antivirus_tracking').where('id', id).first();
    if (!oldAV) return false;

    await db('antivirus_tracking').where('id', id).del();
    await logAudit(req, { action: 'Delete Antivirus Record', module: 'Endpoints', recordId: id, oldValues: { antivirus_name: oldAV.antivirus_name } });
    return true;
  }
}

module.exports = new EndpointsService();
