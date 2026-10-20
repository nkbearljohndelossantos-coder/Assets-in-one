const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { getNextNumber } = require('../utils/numberSequence');
const { uploadImage, uploadDocument } = require('../utils/uploader');
const path = require('path');
const fs = require('fs');
const { syncAssetsToManagedDevices } = require('../utils/assetDeviceSync');

// Get asset categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await db('asset_categories').select('*').orderBy('name', 'asc');
    return res.json({ success: true, data: categories });
  } catch (err) {
    logger.error(`Get asset categories error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve asset categories.' });
  }
});

// Get all assets (paginated, searched, filtered)
router.get('/', authenticateToken, requirePermission('assets.view'), async (req, res) => {
  const { page = 1, limit = 10, search = '', categoryId = '', status = '', condition = '', warrantyExpiring = 'false' } = req.query;
  const isSqlite = db.client.config.client === 'sqlite3';
  const concatEmpName = isSqlite 
    ? db.raw("TRIM(COALESCE(employees.first_name, '') || ' ' || COALESCE(employees.last_name, '')) as employee_name") 
    : db.raw("TRIM(CONCAT(COALESCE(employees.first_name, ''), ' ', COALESCE(employees.last_name, ''))) as employee_name");

  try {
    const query = db('assets')
      .leftJoin('asset_categories', 'assets.category_id', 'asset_categories.id')
      .leftJoin('departments', 'assets.department_id', 'departments.id')
      .leftJoin('employees', 'assets.employee_id', 'employees.id')
      .select(
        'assets.*',
        'asset_categories.name as category_name',
        'departments.name as department_name',
        concatEmpName
      );

    // Filters
    if (search) {
      query.where((builder) => {
        builder.where('assets.asset_code', 'like', `%${search}%`)
          .orWhere('assets.name', 'like', `%${search}%`)
          .orWhere('assets.brand', 'like', `%${search}%`)
          .orWhere('assets.model', 'like', `%${search}%`)
          .orWhere('assets.serial_number', 'like', `%${search}%`)
          .orWhere('assets.call_sign', 'like', `%${search}%`)
          .orWhere('assets.radio_frequency_band', 'like', `%${search}%`)
          .orWhere('assets.license_number', 'like', `%${search}%`)
          .orWhere('assets.mouse_connectivity', 'like', `%${search}%`)
          .orWhere('assets.current_location', 'like', `%${search}%`);
      });
    }

    if (categoryId) query.where('assets.category_id', categoryId);
    if (status) query.where('assets.status', status);
    if (condition) query.where('assets.condition', condition);

    // Warranty expiring warning (e.g. within 30 days)
    if (warrantyExpiring === 'true') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const todayStr = new Date().toISOString().split('T')[0];
      const limitStr = thirtyDaysFromNow.toISOString().split('T')[0];
      
      query.where('assets.warranty_end_date', '>=', todayStr)
        .andWhere('assets.warranty_end_date', '<=', limitStr);
    }

    // Total Count
    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    // Pagination
    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('assets.asset_code', 'desc')
      .limit(limit)
      .offset(offset);

    return res.json({
      success: true,
      data: {
        assets: data,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (err) {
    logger.error(`Get assets list error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve assets list.' });
  }
});

// Fast Public QR Scan Asset Specs Lookup (No Token Required for Scanning Stickers)
router.get('/public-specs/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const isSqlite = db.client.config.client === 'sqlite3';
    const concatEmpName = isSqlite 
      ? db.raw("TRIM(COALESCE(employees.first_name, '') || ' ' || COALESCE(employees.last_name, '')) as employee_name") 
      : db.raw("TRIM(CONCAT(COALESCE(employees.first_name, ''), ' ', COALESCE(employees.last_name, ''))) as employee_name");

    const asset = await db('assets')
      .leftJoin('asset_categories', 'assets.category_id', 'asset_categories.id')
      .leftJoin('departments', 'assets.department_id', 'departments.id')
      .leftJoin('employees', 'assets.employee_id', 'employees.id')
      .select(
        'assets.*',
        'asset_categories.name as category_name',
        'departments.name as department_name',
        concatEmpName
      )
      .where('assets.asset_code', code)
      .orWhere('assets.id', code)
      .first();

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    return res.json({ success: true, data: asset });
  } catch (err) {
    logger.error(`Public asset spec error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch asset specifications' });
  }
});

// Get single asset profile by ID or Asset Code
router.get('/:id', authenticateToken, requirePermission('assets.view'), async (req, res) => {
  const { id } = req.params;
  const isSqlite = db.client.config.client === 'sqlite3';
  const concatEmpName = isSqlite 
    ? db.raw("TRIM(COALESCE(employees.first_name, '') || ' ' || COALESCE(employees.last_name, '')) as employee_name") 
    : db.raw("TRIM(CONCAT(COALESCE(employees.first_name, ''), ' ', COALESCE(employees.last_name, ''))) as employee_name");

  try {
    const asset = await db('assets')
      .leftJoin('asset_categories', 'assets.category_id', 'asset_categories.id')
      .leftJoin('departments', 'assets.department_id', 'departments.id')
      .leftJoin('employees', 'assets.employee_id', 'employees.id')
      .select(
        'assets.*',
        'asset_categories.name as category_name',
        'departments.name as department_name',
        concatEmpName
      )
      .where((builder) => {
        builder.where('assets.id', id).orWhere('assets.asset_code', id);
      })
      .first();

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    // Retrieve supporting documents
    const documents = await db('asset_documents').where('asset_id', asset.id);

    // Retrieve history log
    const history = await db('asset_history')
      .leftJoin('users', 'asset_history.performed_by', 'users.id')
      .select('asset_history.*', 'users.username as performed_by_username')
      .where('asset_history.asset_id', asset.id)
      .orderBy('asset_history.created_at', 'desc');

    // Retrieve active assignments
    const assignments = await db('asset_assignments')
      .leftJoin('employees', 'asset_assignments.employee_id', 'employees.id')
      .leftJoin('departments', 'asset_assignments.department_id', 'departments.id')
      .select(
        'asset_assignments.*',
        concatEmpName,
        'departments.name as department_name'
      )
      .where('asset_assignments.asset_id', asset.id)
      .orderBy('asset_assignments.created_at', 'desc');

    return res.json({
      success: true,
      data: {
        asset,
        documents,
        history,
        assignments
      }
    });

  } catch (err) {
    logger.error(`Get asset by ID error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve asset profile.' });
  }
});

// Create Asset (auto generates asset code, QR code and barcode)
router.post('/', authenticateToken, requirePermission('assets.create'), uploadImage.single('image'), async (req, res) => {
  const assetData = req.body;

  if (!assetData.name || !assetData.category_id || !assetData.brand || !assetData.model || !assetData.serial_number) {
    return res.status(400).json({ success: false, message: 'Name, Category, Brand, Model, and Serial Number are required.' });
  }

  try {
    // Check serial number uniqueness
    const exists = await db('assets').where('serial_number', assetData.serial_number).first();
    if (exists) {
      return res.status(400).json({ success: false, message: `Serial number '${assetData.serial_number}' already exists.` });
    }

    let newAssetId;
    await db.transaction(async (trx) => {
      // 1. Generate unique asset code
      const assetCode = await getNextNumber('Asset', trx);

      // 2. Prepare file upload path (Store Base64 in DB for 100% permanent preservation on Hostinger)
      let imagePath = null;
      if (req.file) {
        try {
          const fileBuffer = fs.readFileSync(req.file.path);
          imagePath = `data:${req.file.mimetype || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`;
        } catch (e) {
          imagePath = `/uploads/images/${req.file.filename}`;
        }
      } else if (req.body.image_path && String(req.body.image_path).startsWith('data:image/')) {
        imagePath = req.body.image_path;
      } else if (req.body.image && String(req.body.image).startsWith('data:image/')) {
        imagePath = req.body.image;
      }

      // 3. QR code text payload
      const qrText = `NKB-ITMS:ASSET:${assetCode}`;
      const barcodeText = assetCode; // Use asset code as barcode

      // 4. Insert Asset
      const [id] = await trx('assets').insert({
        asset_code: assetCode,
        qr_code: qrText,
        barcode: barcodeText,
        name: assetData.name,
        category_id: assetData.category_id,
        brand: assetData.brand,
        model: assetData.model,
        serial_number: assetData.serial_number,
        description: assetData.description || null,
        specs_cpu: assetData.specs_cpu || null,
        specs_ram: assetData.specs_ram || null,
        specs_storage: assetData.specs_storage || null,
        specs_os: assetData.specs_os || null,
        specs_win_edition: assetData.specs_win_edition || null,
        imei_number: assetData.imei_number || null,
        phone_number: assetData.phone_number || null,
        sim_carrier: assetData.sim_carrier || null,
        mdm_enrolled: assetData.mdm_enrolled === true || assetData.mdm_enrolled === 'true',
        mdm_device_id: assetData.mdm_device_id || null,
        radio_frequency_band: assetData.radio_frequency_band || null,
        radio_channel_count: assetData.radio_channel_count || null,
        radio_power_output: assetData.radio_power_output || null,
        call_sign: assetData.call_sign || null,
        license_number: assetData.license_number || null,
        battery_serial: assetData.battery_serial || null,
        mouse_connectivity: assetData.mouse_connectivity || null,
        mouse_sensor_dpi: assetData.mouse_sensor_dpi || null,
        mouse_buttons_count: assetData.mouse_buttons_count || null,
        mouse_hand_orientation: assetData.mouse_hand_orientation || null,
        hostname: assetData.hostname || null,
        mac_address: assetData.mac_address || null,
        ip_address: assetData.ip_address || null,
        purchase_date: assetData.purchase_date || null,
        purchase_price: assetData.purchase_price || 0,
        supplier: assetData.supplier || null,
        invoice_number: assetData.invoice_number || null,
        warranty_start_date: assetData.warranty_start_date || null,
        warranty_end_date: assetData.warranty_end_date || null,
        condition: assetData.condition || 'New',
        status: 'Available', // Default starting status
        remarks: assetData.remarks || null,
        image_path: imagePath,
        created_by: req.user.id,
        updated_by: null,
        created_at: new Date(),
        updated_at: new Date()
      });
      newAssetId = id;

      // 5. Write to Asset History
      await trx('asset_history').insert({
        asset_id: newAssetId,
        action: 'Create',
        notes: `Asset profile created under code: ${assetCode}`,
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    const newAsset = await db('assets').where('id', newAssetId).first();
    await logAudit(req, { action: 'Create Asset', module: 'Assets', recordId: newAssetId, newValues: newAsset });

    // Synchronize to Remote Devices
    syncAssetsToManagedDevices().catch(err => logger.error(`Asset sync error: ${err.message}`));

    return res.json({
      success: true,
      message: 'Asset created successfully.',
      data: newAsset
    });

  } catch (err) {
    logger.error(`Create asset error: ${err.message}`);
    // Clean up uploaded image if transaction failed
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).json({ success: false, message: `Failed to create asset: ${err.message}` });
  }
});

// Add documents to an asset (invoice, warranty, manual)
router.post('/:id/documents', authenticateToken, requirePermission('assets.update'), uploadDocument.array('files'), async (req, res) => {
  const { id } = req.params;

  if (!req.files || !req.files.length) {
    return res.status(400).json({ success: false, message: 'No documents were uploaded.' });
  }

  try {
    const asset = await db('assets').where('id', id).first();
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    const insertedDocs = [];
    await db.transaction(async (trx) => {
      for (const file of req.files) {
        const docPath = `/uploads/documents/${file.filename}`;
        
        const [docId] = await trx('asset_documents').insert({
          asset_id: id,
          name: file.originalname,
          file_path: docPath,
          file_size: file.size,
          file_type: path.extname(file.originalname).substring(1),
          created_at: new Date()
        });

        insertedDocs.push({ id: docId, name: file.originalname, file_path: docPath });
      }

      // Add to Asset History
      await trx('asset_history').insert({
        asset_id: id,
        action: 'Update',
        notes: `Uploaded ${req.files.length} supporting document(s).`,
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    await logAudit(req, { action: 'Upload Asset Documents', module: 'Assets', recordId: id, newValues: insertedDocs });

    return res.json({
      success: true,
      message: 'Supporting documents uploaded successfully.',
      data: insertedDocs
    });

  } catch (err) {
    logger.error(`Upload asset docs error: ${err.message}`);
    // Clean up uploaded files on fail
    if (req.files) {
      req.files.forEach(f => fs.unlink(f.path, () => {}));
    }
    return res.status(500).json({ success: false, message: 'Failed to upload documents.' });
  }
});

// Update Asset
router.put('/:id', authenticateToken, requirePermission('assets.update'), uploadImage.single('image'), async (req, res) => {
  const { id } = req.params;
  const assetData = req.body;

  try {
    const oldAsset = await db('assets').where('id', id).first();
    if (!oldAsset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    // Validate unique serial number
    if (assetData.serial_number) {
      const serialExists = await db('assets')
        .where('serial_number', assetData.serial_number)
        .whereNot('id', id)
        .first();
      if (serialExists) {
        return res.status(400).json({ success: false, message: `Serial number '${assetData.serial_number}' is already registered to another asset.` });
      }
    }

    let newImagePath = oldAsset.image_path;
    if (req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        newImagePath = `data:${req.file.mimetype || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`;
      } catch (e) {
        newImagePath = `/uploads/images/${req.file.filename}`;
      }
    } else if (req.body.image_path && String(req.body.image_path).startsWith('data:image/')) {
      newImagePath = req.body.image_path;
    } else if (req.body.image && String(req.body.image).startsWith('data:image/')) {
      newImagePath = req.body.image;
    } else if (assetData.image_path && assetData.image_path !== 'null' && assetData.image_path !== 'undefined' && String(assetData.image_path).trim() !== '') {
      newImagePath = assetData.image_path;
    }
    
    // Always preserve existing photo if no new image uploaded
    if (!newImagePath || newImagePath === 'null' || newImagePath === 'undefined') {
      newImagePath = oldAsset.image_path;
    }

    await db.transaction(async (trx) => {
      // 1. Update fields
      await trx('assets').where('id', id).update({
        name: assetData.name || oldAsset.name,
        category_id: assetData.category_id || oldAsset.category_id,
        brand: assetData.brand || oldAsset.brand,
        model: assetData.model || oldAsset.model,
        serial_number: assetData.serial_number || oldAsset.serial_number,
        description: assetData.description !== undefined ? assetData.description : oldAsset.description,
        specs_cpu: assetData.specs_cpu !== undefined ? assetData.specs_cpu : oldAsset.specs_cpu,
        specs_ram: assetData.specs_ram !== undefined ? assetData.specs_ram : oldAsset.specs_ram,
        specs_storage: assetData.specs_storage !== undefined ? assetData.specs_storage : oldAsset.specs_storage,
        specs_os: assetData.specs_os !== undefined ? assetData.specs_os : oldAsset.specs_os,
        specs_win_edition: assetData.specs_win_edition !== undefined ? assetData.specs_win_edition : oldAsset.specs_win_edition,
        imei_number: assetData.imei_number !== undefined ? assetData.imei_number : oldAsset.imei_number,
        phone_number: assetData.phone_number !== undefined ? assetData.phone_number : oldAsset.phone_number,
        sim_carrier: assetData.sim_carrier !== undefined ? assetData.sim_carrier : oldAsset.sim_carrier,
        mdm_enrolled: assetData.mdm_enrolled !== undefined ? (assetData.mdm_enrolled === true || assetData.mdm_enrolled === 'true') : oldAsset.mdm_enrolled,
        mdm_device_id: assetData.mdm_device_id !== undefined ? assetData.mdm_device_id : oldAsset.mdm_device_id,
        radio_frequency_band: assetData.radio_frequency_band !== undefined ? assetData.radio_frequency_band : oldAsset.radio_frequency_band,
        radio_channel_count: assetData.radio_channel_count !== undefined ? assetData.radio_channel_count : oldAsset.radio_channel_count,
        radio_power_output: assetData.radio_power_output !== undefined ? assetData.radio_power_output : oldAsset.radio_power_output,
        call_sign: assetData.call_sign !== undefined ? assetData.call_sign : oldAsset.call_sign,
        license_number: assetData.license_number !== undefined ? assetData.license_number : oldAsset.license_number,
        battery_serial: assetData.battery_serial !== undefined ? assetData.battery_serial : oldAsset.battery_serial,
        mouse_connectivity: assetData.mouse_connectivity !== undefined ? assetData.mouse_connectivity : oldAsset.mouse_connectivity,
        mouse_sensor_dpi: assetData.mouse_sensor_dpi !== undefined ? assetData.mouse_sensor_dpi : oldAsset.mouse_sensor_dpi,
        mouse_buttons_count: assetData.mouse_buttons_count !== undefined ? assetData.mouse_buttons_count : oldAsset.mouse_buttons_count,
        mouse_hand_orientation: assetData.mouse_hand_orientation !== undefined ? assetData.mouse_hand_orientation : oldAsset.mouse_hand_orientation,
        hostname: assetData.hostname !== undefined ? assetData.hostname : oldAsset.hostname,
        mac_address: assetData.mac_address !== undefined ? assetData.mac_address : oldAsset.mac_address,
        ip_address: assetData.ip_address !== undefined ? assetData.ip_address : oldAsset.ip_address,
        purchase_date: assetData.purchase_date !== undefined ? assetData.purchase_date : oldAsset.purchase_date,
        purchase_price: assetData.purchase_price !== undefined ? assetData.purchase_price : oldAsset.purchase_price,
        supplier: assetData.supplier !== undefined ? assetData.supplier : oldAsset.supplier,
        invoice_number: assetData.invoice_number !== undefined ? assetData.invoice_number : oldAsset.invoice_number,
        warranty_start_date: assetData.warranty_start_date !== undefined ? assetData.warranty_start_date : oldAsset.warranty_start_date,
        warranty_end_date: assetData.warranty_end_date !== undefined ? assetData.warranty_end_date : oldAsset.warranty_end_date,
        condition: assetData.condition || oldAsset.condition,
        status: assetData.status || oldAsset.status,
        remarks: assetData.remarks !== undefined ? assetData.remarks : oldAsset.remarks,
        image_path: newImagePath,
        updated_by: req.user.id,
        updated_at: new Date()
      });

      // 2. Track differences for history logs
      let notes = 'Updated asset details.';
      if (assetData.condition && assetData.condition !== oldAsset.condition) {
        notes += ` Condition changed from '${oldAsset.condition}' to '${assetData.condition}'.`;
      }
      if (assetData.status && assetData.status !== oldAsset.status) {
        notes += ` Status changed from '${oldAsset.status}' to '${assetData.status}'.`;
      }

      await trx('asset_history').insert({
        asset_id: id,
        action: 'Update',
        notes: notes,
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    const updatedAsset = await db('assets').where('id', id).first();
    await logAudit(req, { action: 'Update Asset', module: 'Assets', recordId: id, oldValues: oldAsset, newValues: updatedAsset });

    return res.json({ success: true, message: 'Asset updated successfully.', data: updatedAsset });

  } catch (err) {
    logger.error(`Update asset error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update asset profile.' });
  }
});

// Soft Delete Asset (sets status to 'Retired')
router.delete('/:id', authenticateToken, requirePermission('assets.delete'), async (req, res) => {
  const { id } = req.params;

  try {
    const asset = await db('assets').where('id', id).first();
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    // Enforce business logic: if asset has assignment history, it MUST only be soft deleted (Retired)
    const hasAssignments = await db('asset_assignments').where('asset_id', id).first();
    const hasRepairs = await db('repairs').where('asset_id', id).first();
    const hasPM = await db('maintenance_schedules').where('asset_id', id).first();

    if (hasAssignments || hasRepairs || hasPM) {
      await db.transaction(async (trx) => {
        await trx('assets').where('id', id).update({
          status: 'Retired',
          remarks: `${asset.remarks || ''} [Retired via admin delete command on ${new Date().toLocaleDateString()}]`,
          updated_at: new Date()
        });

        await trx('asset_history').insert({
          asset_id: id,
          action: 'Update',
          notes: 'Asset soft deleted by admin. Status set to Retired.',
          performed_by: req.user.id,
          created_at: new Date()
        });
      });

      await logAudit(req, { action: 'Soft Delete Asset (Retire)', module: 'Assets', recordId: id });
      return res.json({
        success: true,
        message: 'Asset has transaction history and cannot be hard deleted. Its status has been updated to Retired.'
      });
    }

    // If no transactions exist, hard delete is permitted
    await db.transaction(async (trx) => {
      // Delete documents first
      await trx('asset_documents').where('asset_id', id).del();
      await trx('asset_history').where('asset_id', id).del();
      await trx('assets').where('id', id).del();
    });

    await logAudit(req, { action: 'Delete Asset (Hard)', module: 'Assets', recordId: id, oldValues: asset });
    return res.json({ success: true, message: 'Asset profile deleted successfully.' });

  } catch (err) {
    logger.error(`Delete asset error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to delete asset.' });
  }
});

// ==========================================
// WINDOWS AGENT MANAGEMENT ENDPOINTS FOR ASSETS
// ==========================================

// 1. Generate One-Time Enrollment Token for Asset
router.post('/:id/agent-token', authenticateToken, requirePermission('assets.edit'), async (req, res) => {
  const { id } = req.params;
  const crypto = require('crypto');

  try {
    const asset = await db('assets').where('id', id).first();
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    const rawToken = 'NKB-' + crypto.randomBytes(16).toString('hex').toUpperCase();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

    await db('agent_enrollment_tokens').insert({
      asset_id: id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: req.user.id
    });

    await logAudit(req, { action: 'Generate Agent Enrollment Token', module: 'Assets', recordId: id });

    return res.json({
      success: true,
      data: {
        token: rawToken,
        expiresAt,
        serverUrl: process.env.ITMS_PUBLIC_URL || `${req.protocol}://${req.get('host')}`
      }
    });

  } catch (err) {
    logger.error(`Generate enrollment token error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to generate token.' });
  }
});

// 2. Get Agent & Inventory Details for Asset
router.get('/:id/agent', authenticateToken, requirePermission('assets.view'), async (req, res) => {
  const { id } = req.params;

  try {
    const agent = await db('agents').where('asset_id', id).first();
    if (!agent) {
      return res.json({ success: true, agent: null });
    }

    const hardware = await db('computer_hardware').where('agent_id', agent.id).first();
    const disks = await db('physical_disks').where('agent_id', agent.id);
    const volumes = await db('disk_volumes').where('agent_id', agent.id);
    const network = await db('network_adapters').where('agent_id', agent.id);
    const software = await db('installed_software').where('agent_id', agent.id).orderBy('name', 'asc');
    const security = await db('windows_security_inventory').where('agent_id', agent.id).first();
    const metrics = await db('performance_metrics').where('agent_id', agent.id).orderBy('recorded_at', 'desc').limit(20);
    const recentLogs = await db('agent_logs').where('agent_id', agent.id).orderBy('logged_at', 'desc').limit(25);

    // Calculate Online status: Heartbeat within 90 seconds
    const isOnline = agent.last_heartbeat_at && (new Date() - new Date(agent.last_heartbeat_at)) < 90000;

    return res.json({
      success: true,
      agent: {
        ...agent,
        isOnline
      },
      hardware,
      disks,
      volumes,
      network,
      software,
      security,
      metrics,
      logs: recentLogs
    });

  } catch (err) {
    logger.error(`Get asset agent details error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve agent details.' });
  }
});

// 3. Revoke Agent for Asset
router.post('/:id/agent/revoke', authenticateToken, requirePermission('assets.edit'), async (req, res) => {
  const { id } = req.params;

  try {
    await db('agents').where('asset_id', id).update({
      status: 'revoked',
      enrollment_status: 'revoked',
      revoked_at: new Date()
    });

    await db('managed_devices').where('asset_id', id).update({ is_online: false });
    await logAudit(req, { action: 'Revoke Agent', module: 'Assets', recordId: id });

    return res.json({ success: true, message: 'Agent has been revoked.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to revoke agent.' });
  }
});

module.exports = router;
