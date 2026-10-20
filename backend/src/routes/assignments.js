const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { getNextNumber } = require('../utils/numberSequence');
const { uploadDocument } = require('../utils/uploader');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Get assignment history (paginated, with search)
router.get('/', authenticateToken, requirePermission('assets.view'), async (req, res) => {
  const { page = 1, limit = 10, search = '', status = '' } = req.query;

  try {
    const query = db('asset_assignments')
      .join('assets', 'asset_assignments.asset_id', 'assets.id')
      .leftJoin('employees', 'asset_assignments.employee_id', 'employees.id')
      .leftJoin('departments', 'asset_assignments.department_id', 'departments.id')
      .select(
        'asset_assignments.*',
        'assets.name as asset_name',
        'assets.asset_code',
        'assets.serial_number',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as employee_name"),
        'departments.name as department_name'
      );

    if (search) {
      query.where((builder) => {
        builder.where('asset_assignments.assignment_number', 'like', `%${search}%`)
          .orWhere('assets.name', 'like', `%${search}%`)
          .orWhere('assets.asset_code', 'like', `%${search}%`)
          .orWhere('employees.first_name', 'like', `%${search}%`)
          .orWhere('employees.last_name', 'like', `%${search}%`);
      });
    }

    if (status) {
      query.where('asset_assignments.status', status);
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('asset_assignments.date_assigned', 'desc')
      .limit(limit)
      .offset(offset);

    return res.json({
      success: true,
      data: {
        assignments: data,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (err) {
    logger.error(`Get assignments error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve assignment records.' });
  }
});

// 1. ASSIGN ASSET (to Employee or Department)
router.post('/', authenticateToken, requirePermission('assets.assign'), async (req, res) => {
  const { assetId, employeeId, departmentId, dateAssigned, expectedReturnDate, releaseCondition, remarks } = req.body;

  if (!assetId || (!employeeId && !departmentId) || !dateAssigned || !releaseCondition) {
    return res.status(400).json({ success: false, message: 'Asset, Assignee (Employee or Department), Assignment Date, and Release Condition are required.' });
  }

  try {
    // 1. Check if asset is available
    const asset = await db('assets').where('id', assetId).first();
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    if (asset.status !== 'Available') {
      return res.status(400).json({ success: false, message: `Asset is currently unavailable (Status: ${asset.status}). It must be returned or released first.` });
    }

    let newAssignmentId;
    let assignmentNumber;

    await db.transaction(async (trx) => {
      // 2. Generate assignment number seq
      assignmentNumber = await getNextNumber('Assignment', trx);

      // 3. Insert assignment log
      const [id] = await trx('asset_assignments').insert({
        assignment_number: assignmentNumber,
        asset_id: assetId,
        employee_id: employeeId || null,
        department_id: departmentId || null,
        date_assigned: dateAssigned,
        expected_return_date: expectedReturnDate || null,
        actual_return_date: null,
        issued_by: req.user.id,
        received_by: employeeId || null,
        release_condition: releaseCondition,
        remarks: remarks || null,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      });
      newAssignmentId = id;

      // 4. Update asset status, owner, location
      let currentLocation = 'Assigned';
      if (employeeId) {
        const emp = await trx('employees').where('id', employeeId).first();
        currentLocation = `Assigned to ${emp.first_name} ${emp.last_name}`;
      } else if (departmentId) {
        const dept = await trx('departments').where('id', departmentId).first();
        currentLocation = `Assigned to ${dept.name}`;
      }

      await trx('assets').where('id', assetId).update({
        status: 'Assigned',
        employee_id: employeeId || null,
        department_id: departmentId || null,
        current_location: currentLocation,
        condition: releaseCondition, // update condition to release state
        updated_at: new Date()
      });

      // 5. Insert asset history log
      await trx('asset_history').insert({
        asset_id: assetId,
        action: 'Assign',
        notes: `Assigned under log ${assignmentNumber}. ${currentLocation}. Condition: ${releaseCondition}`,
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    const newAssign = await db('asset_assignments').where('id', newAssignmentId).first();
    await logAudit(req, { action: 'Assign Asset', module: 'Assignments', recordId: newAssignmentId, newValues: newAssign });

    return res.json({
      success: true,
      message: 'Asset assigned successfully.',
      data: newAssign
    });

  } catch (err) {
    logger.error(`Assign asset error: ${err.message}`);
    return res.status(500).json({ success: false, message: `Failed to assign asset: ${err.message}` });
  }
});

// 2. RETURN ASSET
router.post('/:id/return', authenticateToken, requirePermission('assets.return'), async (req, res) => {
  const { id } = req.params; // Assignment ID
  const { actualReturnDate, returnCondition, remarks, assetStatus = 'Available' } = req.body;

  if (!actualReturnDate || !returnCondition) {
    return res.status(400).json({ success: false, message: 'Return Date and Return Condition are required.' });
  }

  try {
    const assignment = await db('asset_assignments').where('id', id).first();
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment record not found.' });

    if (assignment.status !== 'Active') {
      return res.status(400).json({ success: false, message: 'This assignment is already closed/inactive.' });
    }

    await db.transaction(async (trx) => {
      // 1. Update assignment record
      await trx('asset_assignments').where('id', id).update({
        actual_return_date: actualReturnDate,
        return_condition: returnCondition,
        remarks: remarks ? `${assignment.remarks || ''}\nReturn Note: ${remarks}` : assignment.remarks,
        status: 'Returned',
        updated_at: new Date()
      });

      // 2. Update asset status, remove owner links, update condition
      await trx('assets').where('id', assignment.asset_id).update({
        status: assetStatus, // e.g., Available, Under Repair, Damaged, For Inspection
        employee_id: null,
        department_id: null,
        current_location: 'IT Storage',
        condition: returnCondition,
        updated_at: new Date()
      });

      // 3. Write to asset history
      await trx('asset_history').insert({
        asset_id: assignment.asset_id,
        action: 'Return',
        notes: `Returned from assignment ${assignment.assignment_number}. Condition: ${returnCondition}. Asset status set to ${assetStatus}`,
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    const updatedAssign = await db('asset_assignments').where('id', id).first();
    await logAudit(req, { action: 'Return Asset', module: 'Assignments', recordId: id, newValues: updatedAssign });

    return res.json({
      success: true,
      message: 'Asset return registered successfully.',
      data: updatedAssign
    });

  } catch (err) {
    logger.error(`Return asset error: ${err.message}`);
    return res.status(500).json({ success: false, message: `Failed to return asset: ${err.message}` });
  }
});

// 3. TRANSFER ASSET (closes current assignment and launches a new one in one transaction)
router.post('/:id/transfer', authenticateToken, requirePermission('assets.transfer'), async (req, res) => {
  const { id } = req.params; // Existing Assignment ID
  const { employeeId, departmentId, dateTransferred, releaseCondition, remarks } = req.body;

  if ((!employeeId && !departmentId) || !dateTransferred || !releaseCondition) {
    return res.status(400).json({ success: false, message: 'New Assignee (Employee/Dept), Transfer Date, and Condition are required.' });
  }

  try {
    const oldAssign = await db('asset_assignments').where('id', id).first();
    if (!oldAssign) return res.status(404).json({ success: false, message: 'Current active assignment not found.' });

    if (oldAssign.status !== 'Active') {
      return res.status(400).json({ success: false, message: 'Cannot transfer from an inactive assignment.' });
    }

    let newAssignId;
    let newAssignNum;

    await db.transaction(async (trx) => {
      // 1. Close current assignment as Transferred
      await trx('asset_assignments').where('id', id).update({
        actual_return_date: dateTransferred,
        return_condition: releaseCondition,
        remarks: remarks ? `${oldAssign.remarks || ''}\nTransferred on ${dateTransferred}. Note: ${remarks}` : oldAssign.remarks,
        status: 'Transferred',
        updated_at: new Date()
      });

      // 2. Generate new assignment sequence
      newAssignNum = await getNextNumber('Assignment', trx);

      // 3. Create the NEW assignment record
      const [newId] = await trx('asset_assignments').insert({
        assignment_number: newAssignNum,
        asset_id: oldAssign.asset_id,
        employee_id: employeeId || null,
        department_id: departmentId || null,
        date_assigned: dateTransferred,
        expected_return_date: null,
        issued_by: req.user.id,
        received_by: employeeId || null,
        release_condition: releaseCondition,
        remarks: `Transferred from ${oldAssign.assignment_number}. Remarks: ${remarks || ''}`,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      });
      newAssignId = newId;

      // 4. Update the Asset owner details
      let currentLocation = 'Assigned (Transferred)';
      if (employeeId) {
        const emp = await trx('employees').where('id', employeeId).first();
        currentLocation = `Assigned to ${emp.first_name} ${emp.last_name} (Transferred)`;
      } else if (departmentId) {
        const dept = await trx('departments').where('id', departmentId).first();
        currentLocation = `Assigned to ${dept.name} (Transferred)`;
      }

      await trx('assets').where('id', oldAssign.asset_id).update({
        employee_id: employeeId || null,
        department_id: departmentId || null,
        current_location: currentLocation,
        condition: releaseCondition,
        updated_at: new Date()
      });

      // 5. Write to Asset History
      await trx('asset_history').insert({
        asset_id: oldAssign.asset_id,
        action: 'Transfer',
        notes: `Transferred from ${oldAssign.assignment_number} to ${newAssignNum}. ${currentLocation}. Condition: ${releaseCondition}`,
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    const newAssignObj = await db('asset_assignments').where('id', newAssignId).first();
    await logAudit(req, { action: 'Transfer Asset', module: 'Assignments', recordId: newAssignId, newValues: newAssignObj });

    return res.json({
      success: true,
      message: 'Asset transferred successfully.',
      data: newAssignObj
    });

  } catch (err) {
    logger.error(`Transfer asset error: ${err.message}`);
    return res.status(500).json({ success: false, message: `Failed to transfer asset: ${err.message}` });
  }
});

// 4. UPLOAD SIGNED ACKNOWLEDGMENT
router.post('/:id/acknowledgment', authenticateToken, requirePermission('assets.assign'), uploadDocument.single('file'), async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file was uploaded.' });
  }

  const filePath = `/uploads/documents/${req.file.filename}`;
  try {
    const assignment = await db('asset_assignments').where('id', id).first();
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment record not found.' });

    await db.transaction(async (trx) => {
      // Update acknowledgment file path
      await trx('asset_assignments').where('id', id).update({
        acknowledgment_file_path: filePath,
        updated_at: new Date()
      });

      // Log in Asset History
      await trx('asset_history').insert({
        asset_id: assignment.asset_id,
        action: 'Update',
        notes: `Signed acknowledgment receipt uploaded. File: ${req.file.originalname}`,
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    await logAudit(req, { action: 'Upload Acknowledgment', module: 'Assignments', recordId: id, newValues: { file_path: filePath } });

    return res.json({
      success: true,
      message: 'Signed acknowledgment receipt uploaded successfully.',
      data: { acknowledgment_file_path: filePath }
    });

  } catch (err) {
    logger.error(`Upload acknowledgment receipt error: ${err.message}`);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ success: false, message: 'Failed to upload acknowledgment receipt.' });
  }
});

// 5. GENERATE PDF ACKNOWLEDGMENT RECEIPT
router.get('/:id/receipt', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const assignment = await db('asset_assignments')
      .join('assets', 'asset_assignments.asset_id', 'assets.id')
      .join('asset_categories', 'assets.category_id', 'asset_categories.id')
      .leftJoin('employees as emp', 'asset_assignments.employee_id', 'emp.id')
      .leftJoin('departments as dept', 'asset_assignments.department_id', 'dept.id')
      .leftJoin('users as issuer', 'asset_assignments.issued_by', 'issuer.id')
      .select(
        'asset_assignments.*',
        'assets.name as asset_name',
        'assets.asset_code',
        'assets.brand',
        'assets.model',
        'assets.serial_number',
        'assets.specs_cpu',
        'assets.specs_ram',
        'assets.specs_storage',
        'assets.specs_os',
        'asset_categories.name as category_name',
        'emp.first_name',
        'emp.last_name',
        'emp.employee_number',
        'emp.email as employee_email',
        'dept.name as dept_name',
        'issuer.username as issuer_username'
      )
      .where('asset_assignments.id', id)
      .first();

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment record not found.' });
    }

    // Set up PDF doc
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Receipt_${assignment.assignment_number}.pdf`);

    doc.pipe(res);

    // Header Title
    doc.font('Helvetica-Bold').fontSize(20).text('NKB TECHNOLOGIES INC.', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('123 Tech Loop, Taguig, Manila, Philippines', { align: 'center' });
    doc.fontSize(14).font('Helvetica-Bold').text('EQUIPMENT ACKNOWLEDGMENT RECEIPT', { align: 'center', margin: 20 });
    doc.moveDown(1.5);

    // Metadata Grid
    doc.fontSize(10).font('Helvetica-Bold').text(`Receipt No: `, { continued: true }).font('Helvetica').text(`${assignment.assignment_number}`, 50);
    doc.font('Helvetica-Bold').text(`Date Assigned: `, { continued: true }).font('Helvetica').text(`${assignment.date_assigned}`);
    if (assignment.expected_return_date) {
      doc.font('Helvetica-Bold').text(`Expected Return Date: `, { continued: true }).font('Helvetica').text(`${assignment.expected_return_date}`);
    }
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('ASSIGNEE INFORMATION:', { underline: true });
    doc.moveDown(0.2);
    if (assignment.first_name) {
      doc.font('Helvetica-Bold').text('Name: ', { continued: true }).font('Helvetica').text(`${assignment.first_name} ${assignment.last_name}`);
      doc.font('Helvetica-Bold').text('Employee ID: ', { continued: true }).font('Helvetica').text(`${assignment.employee_number}`);
      doc.font('Helvetica-Bold').text('Email: ', { continued: true }).font('Helvetica').text(`${assignment.employee_email}`);
    } else {
      doc.font('Helvetica-Bold').text('Department: ', { continued: true }).font('Helvetica').text(`${assignment.dept_name}`);
    }
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').text('EQUIPMENT SPECIFICATIONS:', { underline: true });
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').text('Asset Code: ', { continued: true }).font('Helvetica').text(`${assignment.asset_code}`);
    doc.font('Helvetica-Bold').text('Asset Name: ', { continued: true }).font('Helvetica').text(`${assignment.asset_name}`);
    doc.font('Helvetica-Bold').text('Category: ', { continued: true }).font('Helvetica').text(`${assignment.category_name}`);
    doc.font('Helvetica-Bold').text('Brand / Model: ', { continued: true }).font('Helvetica').text(`${assignment.brand} / ${assignment.model}`);
    doc.font('Helvetica-Bold').text('Serial Number: ', { continued: true }).font('Helvetica').text(`${assignment.serial_number}`);
    
    // Hardware Details
    let specs = '';
    if (assignment.specs_cpu) specs += `CPU: ${assignment.specs_cpu} | `;
    if (assignment.specs_ram) specs += `RAM: ${assignment.specs_ram} | `;
    if (assignment.specs_storage) specs += `Storage: ${assignment.specs_storage} | `;
    if (assignment.specs_os) specs += `OS: ${assignment.specs_os}`;
    
    if (specs) {
      doc.font('Helvetica-Bold').text('Specs: ', { continued: true }).font('Helvetica').text(specs);
    }
    doc.font('Helvetica-Bold').text('Condition Issued: ', { continued: true }).font('Helvetica').text(`${assignment.release_condition}`);
    doc.moveDown(1.5);

    // Terms of custody
    doc.font('Helvetica-Bold').text('TERMS & CONDITIONS:', { underline: true });
    doc.moveDown(0.2);
    const terms = [
      '1. The assignee acknowledges receipt of the equipment listed above in good working condition.',
      '2. The equipment is for official company use only. The assignee must take maximum care of this property.',
      '3. Any loss, damage, or malfunction must be reported immediately to the IT Help Desk.',
      '4. In case of separation from the company, the assignee must return the equipment to the IT Department immediately.'
    ];
    terms.forEach(t => {
      doc.font('Helvetica').text(t);
      doc.moveDown(0.1);
    });
    doc.moveDown(2);

    // Signatures
    const startY = doc.y;
    doc.font('Helvetica-Bold').text('Issued By:', 50, startY);
    doc.moveDown(1.5);
    doc.font('Helvetica').text('_________________________', 50);
    doc.text(`IT Staff: ${assignment.issuer_username}`, 50);

    doc.font('Helvetica-Bold').text('Received By (Assignee):', 320, startY);
    doc.moveDown(1.5);
    doc.font('Helvetica').text('_________________________', 320);
    doc.text(assignment.first_name ? `${assignment.first_name} ${assignment.last_name}` : 'Department Representative', 320);

    doc.end();
    await logAudit(req, { action: 'Print Assignment Receipt', module: 'Assignments', recordId: id });

  } catch (err) {
    logger.error(`Print assignment receipt PDF error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to generate receipt PDF.' });
  }
});

module.exports = router;
