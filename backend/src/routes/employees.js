const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { uploadDocument } = require('../utils/uploader');
const ExcelJS = require('exceljs');
const fs = require('fs');

// ==========================================
// DEPARTMENTS ENDPOINTS
// ==========================================

// Get all departments
router.get('/departments', authenticateToken, async (req, res) => {
  try {
    const depts = await db('departments')
      .leftJoin('employees as head', 'departments.department_head_employee_id', 'head.id')
      .select(
        'departments.*',
        db.raw("concat(head.first_name, ' ', head.last_name) as department_head_name")
      )
      .orderBy('departments.name', 'asc');
    return res.json({ success: true, data: depts });
  } catch (err) {
    logger.error(`Get departments error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve departments.' });
  }
});

// Create department
router.post('/departments', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { code, name, location, description, department_head_employee_id, status } = req.body;

  if (!code || !name || !location) {
    return res.status(400).json({ success: false, message: 'Code, Name, and Location are required.' });
  }

  try {
    const exists = await db('departments').where('code', code).first();
    if (exists) {
      return res.status(400).json({ success: false, message: 'Department code already exists.' });
    }

    const [id] = await db('departments').insert({
      code,
      name,
      location,
      description,
      department_head_employee_id: department_head_employee_id || null,
      status: status || 'active',
      created_at: new Date(),
      updated_at: new Date()
    });

    const newDept = await db('departments').where('id', id).first();
    await logAudit(req, { action: 'Create Department', module: 'Departments', recordId: id, newValues: newDept });

    return res.json({ success: true, message: 'Department created successfully.', data: newDept });
  } catch (err) {
    logger.error(`Create department error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create department.' });
  }
});

// Update department
router.put('/departments/:id', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { id } = req.params;
  const { code, name, location, description, department_head_employee_id, status } = req.body;

  try {
    const oldDept = await db('departments').where('id', id).first();
    if (!oldDept) return res.status(404).json({ success: false, message: 'Department not found.' });

    // Check code collision
    const exists = await db('departments').where('code', code).whereNot('id', id).first();
    if (exists) {
      return res.status(400).json({ success: false, message: 'Department code already exists.' });
    }

    await db('departments').where('id', id).update({
      code,
      name,
      location,
      description,
      department_head_employee_id: department_head_employee_id || null,
      status: status || 'active',
      updated_at: new Date()
    });

    const newDept = await db('departments').where('id', id).first();
    await logAudit(req, { action: 'Update Department', module: 'Departments', recordId: id, oldValues: oldDept, newValues: newDept });

    return res.json({ success: true, message: 'Department updated successfully.', data: newDept });
  } catch (err) {
    logger.error(`Update department error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update department.' });
  }
});


// ==========================================
// EMPLOYEES ENDPOINTS
// ==========================================

// Get employees list (with search, filter, pagination)
router.get('/', authenticateToken, async (req, res) => {
  const { page = 1, limit = 10, search = '', departmentId = '', status = '', employmentStatus = '' } = req.query;

  try {
    const query = db('employees')
      .join('departments', 'employees.department_id', 'departments.id')
      .join('positions', 'employees.position_id', 'positions.id')
      .select(
        'employees.*',
        'departments.name as department_name',
        'positions.name as position_name',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as full_name")
      );

    // Apply filters
    if (search) {
      query.where((builder) => {
        builder.where('employees.employee_number', 'like', `%${search}%`)
          .orWhere('employees.first_name', 'like', `%${search}%`)
          .orWhere('employees.last_name', 'like', `%${search}%`)
          .orWhere('employees.email', 'like', `%${search}%`);
      });
    }

    if (departmentId) {
      query.where('employees.department_id', departmentId);
    }

    if (status) {
      query.where('employees.status', status);
    }

    if (employmentStatus) {
      query.where('employees.employment_status', employmentStatus);
    }

    // Clone query for counting total
    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    // Get paginated results
    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('employees.employee_number', 'asc')
      .limit(limit)
      .offset(offset);

    return res.json({
      success: true,
      data: {
        employees: data,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (err) {
    logger.error(`Get employees list error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve employees.' });
  }
});

// Create employee
router.post('/', authenticateToken, requirePermission('users.create'), async (req, res) => {
  const { employee_number, first_name, middle_name, last_name, email, phone, position_id, department_id, employment_status, date_hired, status } = req.body;

  if (!employee_number || !first_name || !last_name || !email || !position_id || !department_id || !employment_status || !date_hired) {
    return res.status(400).json({ success: false, message: 'Required fields are missing.' });
  }

  try {
    // Unique validations
    const numExists = await db('employees').where('employee_number', employee_number).first();
    if (numExists) return res.status(400).json({ success: false, message: 'Employee number already exists.' });

    const emailExists = await db('employees').where('email', email).first();
    if (emailExists) return res.status(400).json({ success: false, message: 'Email address already exists.' });

    const [id] = await db('employees').insert({
      employee_number,
      first_name,
      middle_name: middle_name || null,
      last_name,
      email,
      phone,
      position_id,
      department_id,
      employment_status,
      date_hired,
      status: status || 'active',
      created_at: new Date(),
      updated_at: new Date()
    });

    const newEmp = await db('employees').where('id', id).first();
    await logAudit(req, { action: 'Create Employee', module: 'Employees', recordId: id, newValues: newEmp });

    return res.json({ success: true, message: 'Employee created successfully.', data: newEmp });
  } catch (err) {
    logger.error(`Create employee error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create employee.' });
  }
});

// Update employee
router.put('/:id', authenticateToken, requirePermission('users.update'), async (req, res) => {
  const { id } = req.params;
  const { employee_number, first_name, middle_name, last_name, email, phone, position_id, department_id, employment_status, date_hired, status } = req.body;

  try {
    const oldEmp = await db('employees').where('id', id).first();
    if (!oldEmp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    // Validate unique constraints
    const numExists = await db('employees').where('employee_number', employee_number).whereNot('id', id).first();
    if (numExists) return res.status(400).json({ success: false, message: 'Employee number already exists.' });

    const emailExists = await db('employees').where('email', email).whereNot('id', id).first();
    if (emailExists) return res.status(400).json({ success: false, message: 'Email address already exists.' });

    await db('employees').where('id', id).update({
      employee_number,
      first_name,
      middle_name: middle_name || null,
      last_name,
      email,
      phone,
      position_id,
      department_id,
      employment_status,
      date_hired,
      status,
      updated_at: new Date()
    });

    const newEmp = await db('employees').where('id', id).first();
    await logAudit(req, { action: 'Update Employee', module: 'Employees', recordId: id, oldValues: oldEmp, newValues: newEmp });

    return res.json({ success: true, message: 'Employee updated successfully.', data: newEmp });
  } catch (err) {
    logger.error(`Update employee error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update employee.' });
  }
});

// Delete or Deactivate employee
router.delete('/:id', authenticateToken, requirePermission('users.disable'), async (req, res) => {
  const { id } = req.params;

  try {
    const employee = await db('employees').where('id', id).first();
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

    // Check transaction history (assignments, tickets, software licenses)
    const hasAssignments = await db('asset_assignments').where('employee_id', id).first();
    const hasTickets = await db('tickets').where('requested_by_employee_id', id).first();
    const hasLicenses = await db('license_assignments').where('employee_id', id).first();

    if (hasAssignments || hasTickets || hasLicenses) {
      // Soft deactivation instead of hard delete
      await db('employees').where('id', id).update({ status: 'inactive', updated_at: new Date() });
      await logAudit(req, { action: 'Deactivate Employee (Soft)', module: 'Employees', recordId: id });
      return res.json({
        success: true,
        message: 'Employee has transaction history and cannot be deleted. Account status has been set to inactive.'
      });
    }

    // Safely delete if no transactions exist
    await db('employees').where('id', id).del();
    await logAudit(req, { action: 'Delete Employee', module: 'Employees', recordId: id, oldValues: employee });

    return res.json({ success: true, message: 'Employee deleted successfully.' });
  } catch (err) {
    logger.error(`Delete employee error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to delete employee.' });
  }
});

// ==========================================
// EXCEL EXPORT & IMPORT
// ==========================================

// Export employees to Excel
router.get('/export', authenticateToken, requirePermission('reports.export'), async (req, res) => {
  try {
    const employees = await db('employees')
      .join('departments', 'employees.department_id', 'departments.id')
      .join('positions', 'employees.position_id', 'positions.id')
      .select(
        'employees.employee_number',
        'employees.first_name',
        'employees.middle_name',
        'employees.last_name',
        'employees.email',
        'employees.phone',
        'departments.name as department',
        'positions.name as position',
        'employees.employment_status',
        'employees.date_hired',
        'employees.status'
      );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');

    // Title Row
    worksheet.addRow(['NKB IT Management System - Employees Master List']);
    worksheet.addRow([`Generated on: ${new Date().toLocaleString()}`]);
    worksheet.addRow([]); // empty spacing row

    // Table Headers
    worksheet.addRow([
      'Employee Number', 'First Name', 'Middle Name', 'Last Name',
      'Email Address', 'Phone Number', 'Department', 'Position',
      'Employment Status', 'Date Hired', 'Status'
    ]);

    // Format Headers
    worksheet.getRow(4).font = { bold: true };
    worksheet.getRow(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Navy blue
    };
    worksheet.getRow(4).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add Data Rows
    employees.forEach(emp => {
      worksheet.addRow([
        emp.employee_number,
        emp.first_name,
        emp.middle_name || '',
        emp.last_name,
        emp.email,
        emp.phone,
        emp.department,
        emp.position,
        emp.employment_status,
        emp.date_hired,
        emp.status
      ]);
    });

    // Auto-fit column widths
    worksheet.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const valStr = cell.value ? cell.value.toString() : '';
        if (valStr.length > maxLen) maxLen = valStr.length;
      });
      column.width = Math.max(maxLen + 2, 12);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Employees_List.xlsx');

    await workbook.xlsx.write(res);
    res.end();

    await logAudit(req, { action: 'Export Employees Excel', module: 'Employees' });
  } catch (err) {
    logger.error(`Export employees Excel error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to export employees list.' });
  }
});

// Import employees from Excel
router.post('/import', authenticateToken, requirePermission('users.create'), uploadDocument.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No Excel file was uploaded.' });
  }

  const filePath = req.file.path;
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const employeesToInsert = [];
    const errors = [];
    let processedCount = 0;

    // We assume row 1 contains title/headers, so let's start scanning from row 4 or check headers
    // Let's scan and find the header row automatically. We look for 'Employee Number' cell.
    let headerRowIndex = 4; // Default based on our export
    worksheet.eachRow((row, rowNumber) => {
      if (row.getCell(1).value === 'Employee Number' || row.getCell(1).value === 'employee_number') {
        headerRowIndex = rowNumber;
      }
    });

    // Read columns values mapped to keys
    const rowValues = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return; // Skip headers

      const empNum = row.getCell(1).value ? row.getCell(1).value.toString().trim() : null;
      const firstName = row.getCell(2).value ? row.getCell(2).value.toString().trim() : null;
      const middleName = row.getCell(3).value ? row.getCell(3).value.toString().trim() : null;
      const lastName = row.getCell(4).value ? row.getCell(4).value.toString().trim() : null;
      const email = row.getCell(5).value ? row.getCell(5).value.toString().trim() : null;
      const phone = row.getCell(6).value ? row.getCell(6).value.toString().trim() : '';
      const deptCode = row.getCell(7).value ? row.getCell(7).value.toString().trim() : null;
      const posName = row.getCell(8).value ? row.getCell(8).value.toString().trim() : null;
      const empStatus = row.getCell(9).value ? row.getCell(9).value.toString().trim() : 'Regular';
      const dateHiredVal = row.getCell(10).value;
      const status = row.getCell(11).value ? row.getCell(11).value.toString().trim().toLowerCase() : 'active';

      if (!empNum || !firstName || !lastName || !email || !deptCode || !posName) {
        errors.push(`Row ${rowNumber}: Missing required fields (Employee Number, First Name, Last Name, Email, Department, or Position).`);
        return;
      }

      // Handle Excel Date cell types
      let dateHiredStr = '2026-01-01';
      if (dateHiredVal instanceof Date) {
        dateHiredStr = dateHiredVal.toISOString().split('T')[0];
      } else if (dateHiredVal) {
        dateHiredStr = dateHiredVal.toString().trim();
      }

      rowValues.push({
        rowNumber,
        employee_number: empNum,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        email,
        phone,
        deptCode,
        posName,
        employment_status: empStatus,
        date_hired: dateHiredStr,
        status: status === 'active' || status === 'inactive' ? status : 'active'
      });
    });

    // Run verification and inserts
    await db.transaction(async (trx) => {
      for (const item of rowValues) {
        try {
          // Check if employee number or email already exists in database
          const existingNum = await trx('employees').where('employee_number', item.employee_number).first();
          if (existingNum) {
            errors.push(`Row ${item.rowNumber}: Employee number '${item.employee_number}' already exists.`);
            continue;
          }

          const existingEmail = await trx('employees').where('email', item.email).first();
          if (existingEmail) {
            errors.push(`Row ${item.rowNumber}: Email address '${item.email}' already exists.`);
            continue;
          }

          // Check if department exists by code. If not, auto-create a department
          let dept = await trx('departments').where('code', item.deptCode).first();
          if (!dept) {
            const [newDeptId] = await trx('departments').insert({
              code: item.deptCode,
              name: `${item.deptCode} Department`,
              location: 'Main Building',
              status: 'active',
              created_at: new Date(),
              updated_at: new Date()
            });
            dept = { id: newDeptId };
            logger.info(`Auto-created department ${item.deptCode} during import.`);
          }

          // Check if position exists. If not, auto-create
          let pos = await trx('positions').where('name', item.posName).first();
          if (!pos) {
            const [newPosId] = await trx('positions').insert({
              name: item.posName,
              description: 'Created during Excel import',
              created_at: new Date(),
              updated_at: new Date()
            });
            pos = { id: newPosId };
            logger.info(`Auto-created position ${item.posName} during import.`);
          }

          // Insert Employee
          await trx('employees').insert({
            employee_number: item.employee_number,
            first_name: item.first_name,
            middle_name: item.middle_name,
            last_name: item.last_name,
            email: item.email,
            phone: item.phone,
            position_id: pos.id,
            department_id: dept.id,
            employment_status: item.employment_status,
            date_hired: item.date_hired,
            status: item.status,
            created_at: new Date(),
            updated_at: new Date()
          });

          processedCount++;
        } catch (innerErr) {
          errors.push(`Row ${item.rowNumber}: Database insertion error - ${innerErr.message}`);
        }
      }
    });

    // Delete temp file safely
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) logger.error(`Error deleting temp file: ${unlinkErr.message}`);
    });

    await logAudit(req, {
      action: 'Import Employees Excel',
      module: 'Employees',
      notes: `Imported: ${processedCount} records. Errors count: ${errors.length}`
    });

    return res.json({
      success: errors.length === 0,
      message: `Excel import processed. Successfully imported ${processedCount} employees.`,
      data: {
        imported: processedCount,
        errors: errors
      }
    });

  } catch (err) {
    logger.error(`Import employees Excel error: ${err.message}`);
    // Delete temp file safely in case of crash
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return res.status(500).json({ success: false, message: `Failed to import employees list: ${err.message}` });
  }
});

// Sync employees from Canteen Integration API
router.post('/sync-canteen', authenticateToken, requirePermission('users.create'), async (req, res) => {
  const apiUrl = process.env.CANTEEN_API_URL || 'https://canteen.nkbmanufacturing.com/api/integration/employees';
  const apiKey = process.env.CANTEEN_API_KEY || 'NkbCanteenIntegrationSecretApiKey2026';
  const fullUrl = `${apiUrl}?api_key=${apiKey}`;

  try {
    logger.info(`Fetching employee master records from Canteen API: ${apiUrl}`);
    const apiRes = await fetch(fullUrl);
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ success: false, message: `Canteen API returned HTTP ${apiRes.status}` });
    }

    const canteenEmployees = await apiRes.json();
    if (!Array.isArray(canteenEmployees)) {
      return res.status(400).json({ success: false, message: 'Invalid response format from Canteen API.' });
    }

    let addedCount = 0;
    let updatedCount = 0;

    function parseFullName(rawName) {
      if (!rawName) return { first_name: 'N/A', middle_name: '', last_name: 'N/A' };
      const str = rawName.trim();
      if (str.includes(',')) {
        const [lastPart, firstPart] = str.split(',').map(s => s.trim());
        const tokens = (firstPart || '').split(/\s+/);
        if (tokens.length > 1 && tokens[tokens.length - 1].length <= 2) {
          const middle = tokens.pop();
          return { first_name: tokens.join(' '), middle_name: middle, last_name: lastPart };
        }
        return { first_name: firstPart || lastPart, middle_name: '', last_name: lastPart };
      } else {
        const tokens = str.split(/\s+/);
        if (tokens.length === 1) return { first_name: tokens[0], middle_name: '', last_name: 'N/A' };
        const last = tokens.pop();
        return { first_name: tokens.join(' '), middle_name: '', last_name: last };
      }
    }

    await db.transaction(async (trx) => {
      // Find or create default position ("Staff")
      let defaultPos = await trx('positions').where('name', 'Staff').first();
      if (!defaultPos) {
        const [posId] = await trx('positions').insert({
          name: 'Staff',
          description: 'Default staff position',
          created_at: new Date(),
          updated_at: new Date()
        });
        defaultPos = { id: posId };
      }

      for (const item of canteenEmployees) {
        const empNumber = (item.employee_id || item.barcode_number || `EMP-${item.id}`).trim();
        const { first_name, middle_name, last_name } = parseFullName(item.name);
        const deptName = (item.department || 'General').trim() || 'General';
        const empStatus = item.status === 'active' || item.status === 'Active' ? 'active' : 'inactive';

        // Check/create department
        let dept = await trx('departments').where('name', deptName).first();
        if (!dept) {
          const deptCode = deptName.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'DEPT';
          const existingCode = await trx('departments').where('code', deptCode).first();
          const finalCode = existingCode ? `${deptCode}_${Date.now().toString().slice(-3)}` : deptCode;

          const [deptId] = await trx('departments').insert({
            code: finalCode,
            name: deptName,
            location: 'Main Building',
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          });
          dept = { id: deptId };
        }

        const existingEmp = await trx('employees').where('employee_number', empNumber).first();
        if (existingEmp) {
          // Update details
          await trx('employees').where('id', existingEmp.id).update({
            first_name,
            middle_name: middle_name || existingEmp.middle_name,
            last_name,
            department_id: dept.id,
            status: empStatus,
            updated_at: new Date()
          });
          updatedCount++;
        } else {
          // Insert new
          const generatedEmail = `${empNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@nkbmanufacturing.com`;
          await trx('employees').insert({
            employee_number: empNumber,
            first_name,
            middle_name: middle_name || null,
            last_name,
            email: generatedEmail,
            phone: 'N/A',
            position_id: defaultPos.id,
            department_id: dept.id,
            employment_status: 'Regular',
            date_hired: item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            status: empStatus,
            created_at: new Date(),
            updated_at: new Date()
          });
          addedCount++;
        }
      }
    });

    await logAudit(req, {
      action: 'Sync Canteen API Employees',
      module: 'Employees',
      notes: `Synced total: ${canteenEmployees.length}. Added: ${addedCount}, Updated: ${updatedCount}`
    });

    return res.json({
      success: true,
      message: `Canteen API sync completed. Added: ${addedCount}, Updated: ${updatedCount} employees.`,
      data: { added: addedCount, updated: updatedCount, total: canteenEmployees.length }
    });

  } catch (err) {
    logger.error(`Canteen API sync error: ${err.message}`);
    return res.status(500).json({ success: false, message: `Failed to sync Canteen employees: ${err.message}` });
  }
});

module.exports = router;

