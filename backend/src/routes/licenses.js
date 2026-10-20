const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { encrypt, decrypt } = require('../utils/encryption');

// Helper: Mask product key
const maskKey = (key) => {
  if (!key) return '';
  if (key.length <= 8) return '********';
  return `${key.substring(0, 4)}-XXXX-XXXX-${key.substring(key.length - 4)}`;
};

// ==========================================
// 1. LICENSES MASTER LIST (Masked Keys)
// ==========================================
router.get('/', authenticateToken, requirePermission('licenses.view'), async (req, res) => {
  const { page = 1, limit = 10, search = '', status = '' } = req.query;

  try {
    const query = db('software_licenses').select('*');

    if (search) {
      query.where((builder) => {
        builder.where('name', 'like', `%${search}%`)
          .orWhere('vendor', 'like', `%${search}%`)
          .orWhere('supplier', 'like', `%${search}%`);
      });
    }

    if (status) {
      query.where('status', status);
    }

    // Auto flag expiring soon licenses (e.g., within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const todayStr = new Date().toISOString().split('T')[0];
    const limitStr = thirtyDaysFromNow.toISOString().split('T')[0];

    await db('software_licenses')
      .where('status', 'Active')
      .andWhere('expiration_date', '>=', todayStr)
      .andWhere('expiration_date', '<=', limitStr)
      .update({ status: 'Expiring Soon' });

    await db('software_licenses')
      .whereNot('status', 'Expired')
      .andWhere('expiration_date', '<', todayStr)
      .update({ status: 'Expired' });

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('name', 'asc')
      .limit(limit)
      .offset(offset);

    // Mask product keys for safety in public list
    const maskedData = data.map(license => {
      let rawKey = '';
      try {
        rawKey = decrypt(license.product_key_encrypted);
      } catch (e) {}
      return {
        ...license,
        product_key_masked: maskKey(rawKey)
      };
    });

    return res.json({
      success: true,
      data: {
        licenses: maskedData,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (err) {
    logger.error(`Get licenses list error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve software licenses.' });
  }
});

// Reveal sensitive product key (Requires licenses.update/create permissions)
router.get('/:id/reveal', authenticateToken, async (req, res) => {
  const { id } = req.params;

  // Enforce access control: only staff allowed to manage assets can reveal keys
  const hasAuth = req.user.permissions && (req.user.permissions.includes('licenses.update') || req.user.permissions.includes('licenses.create')) || (req.user.roles && req.user.roles.includes('Super Admin'));

  if (!hasAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden. You do not have permission to view sensitive license keys.' });
  }

  try {
    const license = await db('software_licenses').where('id', id).first();
    if (!license) return res.status(404).json({ success: false, message: 'License not found.' });

    const decryptedKey = decrypt(license.product_key_encrypted);
    await logAudit(req, { action: 'Reveal License Key', module: 'Licenses', recordId: id });

    return res.json({ success: true, key: decryptedKey });
  } catch (err) {
    logger.error(`Reveal license key error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to decrypt license key.' });
  }
});

// View single license details and assignments
router.get('/:id', authenticateToken, requirePermission('licenses.view'), async (req, res) => {
  const { id } = req.params;

  try {
    const license = await db('software_licenses').where('id', id).first();
    if (!license) return res.status(404).json({ success: false, message: 'License record not found.' });

    // Retrieve active assignments
    const assignments = await db('license_assignments')
      .leftJoin('employees', 'license_assignments.employee_id', 'employees.id')
      .leftJoin('assets', 'license_assignments.asset_id', 'assets.id')
      .select(
        'license_assignments.*',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as employee_name"),
        'employees.employee_number',
        'assets.name as asset_name',
        'assets.asset_code'
      )
      .where('license_assignments.license_id', id)
      .orderBy('license_assignments.assigned_date', 'desc');

    let decryptedKey = '';
    try {
      decryptedKey = decrypt(license.product_key_encrypted);
    } catch (e) {}

    const responseData = {
      ...license,
      product_key_masked: maskKey(decryptedKey),
      assignments
    };

    return res.json({ success: true, data: responseData });

  } catch (err) {
    logger.error(`Get license details error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve license details.' });
  }
});

// ==========================================
// 2. CREATE LICENSE (Encrypts key)
// ==========================================
router.post('/', authenticateToken, requirePermission('licenses.create'), async (req, res) => {
  const { name, vendor, license_type, product_key, seats_total, purchase_date, expiration_date, purchase_cost = 0, supplier, remarks } = req.body;

  if (!name || !vendor || !license_type || !product_key || !seats_total || !purchase_date) {
    return res.status(400).json({ success: false, message: 'Required fields are missing.' });
  }

  try {
    // Encrypt the product key
    const encryptedKey = encrypt(product_key);

    const [id] = await db('software_licenses').insert({
      name,
      vendor,
      license_type,
      product_key_encrypted: encryptedKey,
      seats_total,
      seats_used: 0,
      purchase_date,
      expiration_date: expiration_date || null,
      purchase_cost,
      supplier: supplier || null,
      status: 'Available',
      remarks: remarks || null,
      created_at: new Date(),
      updated_at: new Date()
    });

    const newLicense = await db('software_licenses').where('id', id).first();
    await logAudit(req, { action: 'Create License', module: 'Licenses', recordId: id, newValues: { name, vendor, seats_total } });

    return res.json({ success: true, message: 'Software license created successfully.', data: newLicense });

  } catch (err) {
    logger.error(`Create license error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create license profile.' });
  }
});

// Update License
router.put('/:id', authenticateToken, requirePermission('licenses.update'), async (req, res) => {
  const { id } = req.params;
  const { name, vendor, license_type, product_key, seats_total, purchase_date, expiration_date, purchase_cost, supplier, status, remarks } = req.body;

  try {
    const oldLicense = await db('software_licenses').where('id', id).first();
    if (!oldLicense) return res.status(404).json({ success: false, message: 'License record not found.' });

    const updates = {
      name: name || oldLicense.name,
      vendor: vendor || oldLicense.vendor,
      license_type: license_type || oldLicense.license_type,
      seats_total: seats_total !== undefined ? seats_total : oldLicense.seats_total,
      purchase_date: purchase_date || oldLicense.purchase_date,
      expiration_date: expiration_date !== undefined ? expiration_date : oldLicense.expiration_date,
      purchase_cost: purchase_cost !== undefined ? purchase_cost : oldLicense.purchase_cost,
      supplier: supplier !== undefined ? supplier : oldLicense.supplier,
      status: status || oldLicense.status,
      remarks: remarks !== undefined ? remarks : oldLicense.remarks,
      updated_at: new Date()
    };

    if (product_key) {
      updates.product_key_encrypted = encrypt(product_key);
    }

    // Verify seat reduction is safe (cannot reduce total below assigned seats)
    if (updates.seats_total < oldLicense.seats_used) {
      return res.status(400).json({ success: false, message: `Cannot reduce total seats to ${updates.seats_total} because ${oldLicense.seats_used} seats are currently assigned.` });
    }

    await db('software_licenses').where('id', id).update(updates);
    const updatedLicense = await db('software_licenses').where('id', id).first();
    
    await logAudit(req, {
      action: 'Update License',
      module: 'Licenses',
      recordId: id,
      oldValues: { name: oldLicense.name, seats_total: oldLicense.seats_total },
      newValues: { name: updatedLicense.name, seats_total: updatedLicense.seats_total }
    });

    return res.json({ success: true, message: 'License details updated successfully.', data: updatedLicense });

  } catch (err) {
    logger.error(`Update license error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update license details.' });
  }
});

// ==========================================
// 3. SEAT ASSIGNMENT (Transaction check)
// ==========================================
router.post('/:id/assign', authenticateToken, requirePermission('licenses.update'), async (req, res) => {
  const { id } = req.params; // License ID
  const { employeeId, assetId, remarks } = req.body;

  if (!employeeId && !assetId) {
    return res.status(400).json({ success: false, message: 'At least one target assignee (Employee or Asset) must be specified.' });
  }

  try {
    const license = await db('software_licenses').where('id', id).first();
    if (!license) return res.status(404).json({ success: false, message: 'License record not found.' });

    // Validate seat counts
    if (license.seats_used >= license.seats_total) {
      return res.status(400).json({ success: false, message: 'License seats are already fully assigned. Increase total seats or revoke a seat first.' });
    }

    // Prevent double assignment of same license to same employee/asset
    if (employeeId) {
      const exists = await db('license_assignments')
        .where({ license_id: id, employee_id: employeeId, status: 'Active' })
        .first();
      if (exists) return res.status(400).json({ success: false, message: 'This license is already assigned to this employee.' });
    }
    if (assetId) {
      const exists = await db('license_assignments')
        .where({ license_id: id, asset_id: assetId, status: 'Active' })
        .first();
      if (exists) return res.status(400).json({ success: false, message: 'This license is already assigned to this asset.' });
    }

    let newAssignId;

    await db.transaction(async (trx) => {
      // 1. Insert assignment
      const [assignId] = await trx('license_assignments').insert({
        license_id: id,
        employee_id: employeeId || null,
        asset_id: assetId || null,
        assigned_date: new Date().toISOString().split('T')[0],
        status: 'Active',
        remarks: remarks || null,
        created_at: new Date()
      });
      newAssignId = assignId;

      // 2. Increment seats used
      const newSeatsUsed = license.seats_used + 1;
      const finalStatus = newSeatsUsed >= license.seats_total ? 'Suspended' : license.status; // mark suspended or active

      await trx('software_licenses').where('id', id).update({
        seats_used: newSeatsUsed,
        updated_at: new Date()
      });
    });

    const newAssignObj = await db('license_assignments').where('id', newAssignId).first();
    await logAudit(req, { action: 'Assign License Seat', module: 'Licenses', recordId: newAssignId, newValues: newAssignObj });

    return res.json({ success: true, message: 'License seat assigned successfully.', data: newAssignObj });

  } catch (err) {
    logger.error(`Assign license seat error: ${err.message}`);
    return res.status(500).json({ success: false, message: `Failed to assign license seat: ${err.message}` });
  }
});

// ==========================================
// 4. SEAT REVOCATION (Unassign)
// ==========================================
router.post('/:id/unassign', authenticateToken, requirePermission('licenses.update'), async (req, res) => {
  const { id } = req.params; // License ID
  const { assignmentId } = req.body;

  if (!assignmentId) return res.status(400).json({ success: false, message: 'Assignment ID is required.' });

  try {
    const license = await db('software_licenses').where('id', id).first();
    if (!license) return res.status(404).json({ success: false, message: 'License record not found.' });

    const assignment = await db('license_assignments').where('id', assignmentId).first();
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment record not found.' });

    if (assignment.status !== 'Active') {
      return res.status(400).json({ success: false, message: 'This license assignment is already closed/returned.' });
    }

    await db.transaction(async (trx) => {
      // 1. Set assignment status to Inactive/Returned
      await trx('license_assignments').where('id', assignmentId).update({
        status: 'Returned',
      });

      // 2. Decrement seats used
      const newSeatsUsed = Math.max(0, license.seats_used - 1);
      
      await trx('software_licenses').where('id', id).update({
        seats_used: newSeatsUsed,
        updated_at: new Date()
      });
    });

    const updatedAssign = await db('license_assignments').where('id', assignmentId).first();
    await logAudit(req, { action: 'Revoke License Seat', module: 'Licenses', recordId: assignmentId, newValues: updatedAssign });

    return res.json({ success: true, message: 'License seat revoked successfully.', data: updatedAssign });

  } catch (err) {
    logger.error(`Revoke license seat error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to revoke license seat.' });
  }
});

module.exports = router;
