const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');

// ==========================================
// 1. USER ACCOUNTS MANAGEMENT (CRUD)
// ==========================================

// Get all users with roles
router.get('/', authenticateToken, requirePermission('users.view'), async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'username', 'email', 'status', 'force_password_change', 'login_attempts', 'locked_until', 'created_at', 'updated_at');

    // Attach roles to each user
    for (const user of users) {
      const userRoles = await db('roles')
        .join('user_roles', 'roles.id', 'user_roles.role_id')
        .where('user_roles.user_id', user.id)
        .select('roles.id', 'roles.name');
      user.roles = userRoles;
    }

    return res.json({ success: true, data: users });
  } catch (err) {
    logger.error(`Get users error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
});

// Create User
router.post('/', authenticateToken, requirePermission('users.create'), async (req, res) => {
  const { username, password, email, roleIds, forcePasswordChange } = req.body;

  if (!username || !password || !email || !roleIds || !roleIds.length) {
    return res.status(400).json({ success: false, message: 'Username, password, email, and at least one role are required.' });
  }

  try {
    const userExists = await db('users').where('username', username).first();
    if (userExists) return res.status(400).json({ success: false, message: 'Username already exists.' });

    const emailExists = await db('users').where('email', email).first();
    if (emailExists) return res.status(400).json({ success: false, message: 'Email already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);

    let newUserId;
    await db.transaction(async (trx) => {
      // 1. Insert user
      const [insertedId] = await trx('users').insert({
        username,
        password_hash: passwordHash,
        email,
        status: 'active',
        force_password_change: !!forcePasswordChange,
        created_at: new Date(),
        updated_at: new Date()
      });
      newUserId = insertedId;

      // 2. Insert roles
      const userRoleMappings = roleIds.map(roleId => ({
        user_id: newUserId,
        role_id: roleId
      }));
      await trx('user_roles').insert(userRoleMappings);
    });

    const createdUser = await db('users').where('id', newUserId).first();
    await logAudit(req, { action: 'Create User', module: 'Users', recordId: newUserId, newValues: { username, email, roleIds } });

    return res.json({
      success: true,
      message: 'User account created successfully.',
      data: createdUser
    });

  } catch (err) {
    logger.error(`Create user error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create user account.' });
  }
});

// Update User (Status, Roles, Email)
router.put('/:id', authenticateToken, requirePermission('users.update'), async (req, res) => {
  const { id } = req.params;
  const { email, status, roleIds, forcePasswordChange, password } = req.body;

  if (!email || !roleIds || !roleIds.length) {
    return res.status(400).json({ success: false, message: 'Email and at least one role are required.' });
  }

  try {
    const user = await db('users').where('id', id).first();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Validate email unique
    const emailExists = await db('users').where('email', email).whereNot('id', id).first();
    if (emailExists) return res.status(400).json({ success: false, message: 'Email already exists.' });

    const oldRoles = await db('user_roles').where('user_id', id).select('role_id');

    await db.transaction(async (trx) => {
      const updates = {
        email,
        status,
        force_password_change: !!forcePasswordChange,
        updated_at: new Date()
      };

      if (password) {
        updates.password_hash = await bcrypt.hash(password, 10);
      }

      // 1. Update user fields
      await trx('users').where('id', id).update(updates);

      // 2. Update roles mappings (clear old and insert new)
      await trx('user_roles').where('user_id', id).del();
      const userRoleMappings = roleIds.map(roleId => ({
        user_id: id,
        role_id: roleId
      }));
      await trx('user_roles').insert(userRoleMappings);
    });

    const updatedUser = await db('users').where('id', id).first();
    await logAudit(req, {
      action: 'Update User',
      module: 'Users',
      recordId: id,
      oldValues: { email: user.email, status: user.status, roleIds: oldRoles.map(r => r.role_id) },
      newValues: { email, status, roleIds }
    });

    return res.json({ success: true, message: 'User account updated successfully.', data: updatedUser });
  } catch (err) {
    logger.error(`Update user error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update user account.' });
  }
});

// Disable / Enable User
router.put('/:id/status', authenticateToken, requirePermission('users.disable'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // active or inactive

  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ success: false, message: "Status must be 'active' or 'inactive'." });
  }

  try {
    const user = await db('users').where('id', id).first();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Protect active session user from disabling their own account
    if (user.id === req.user.id && status === 'inactive') {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    await db('users').where('id', id).update({ status, updated_at: new Date() });
    
    // Clear refresh tokens if deactivated to force immediate logout
    if (status === 'inactive') {
      await db('refresh_tokens').where('user_id', id).del();
    }

    await logAudit(req, { action: status === 'active' ? 'Enable User' : 'Disable User', module: 'Users', recordId: id });

    return res.json({ success: true, message: `User account has been set to ${status}.` });
  } catch (err) {
    logger.error(`User status toggle error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
});

// ==========================================
// 2. ROLE & PERMISSIONS MATRIX ENDPOINTS
// ==========================================

// Get all roles list
router.get('/roles', authenticateToken, async (req, res) => {
  try {
    const roles = await db('roles').select('*');
    return res.json({ success: true, data: roles });
  } catch (err) {
    logger.error(`Get roles list error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve roles.' });
  }
});

// Get all permissions list
router.get('/permissions', authenticateToken, async (req, res) => {
  try {
    const permissions = await db('permissions').select('*');
    return res.json({ success: true, data: permissions });
  } catch (err) {
    logger.error(`Get permissions list error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve permissions.' });
  }
});

// Get role permission mappings (matrix cells)
router.get('/role-permissions', authenticateToken, requirePermission('audit_logs.view'), async (req, res) => {
  try {
    const mappings = await db('role_permissions').select('*');
    return res.json({ success: true, data: mappings });
  } catch (err) {
    logger.error(`Get role permissions error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve role-permission mappings.' });
  }
});

// Save role permission mappings (Permission Matrix)
router.post('/role-permissions', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { matrix } = req.body; // Array of { roleId, permissionId, enabled: boolean }

  if (!matrix || !Array.isArray(matrix)) {
    return res.status(400).json({ success: false, message: 'Matrix payload array is required.' });
  }

  try {
    const oldMappings = await db('role_permissions').select('*');

    await db.transaction(async (trx) => {
      for (const item of matrix) {
        const { roleId, permissionId, enabled } = item;
        
        if (enabled) {
          // Check if mapping exists, if not insert
          const exists = await trx('role_permissions')
            .where({ role_id: roleId, permission_id: permissionId })
            .first();
          if (!exists) {
            await trx('role_permissions').insert({ role_id: roleId, permission_id: permissionId });
          }
        } else {
          // If mapping exists, delete
          await trx('role_permissions')
            .where({ role_id: roleId, permission_id: permissionId })
            .del();
        }
      }
    });

    const newMappings = await db('role_permissions').select('*');
    await logAudit(req, {
      action: 'Update Permission Matrix',
      module: 'Settings',
      oldValues: oldMappings,
      newValues: newMappings
    });

    return res.json({ success: true, message: 'Permissions matrix updated successfully.' });
  } catch (err) {
    logger.error(`Save role permissions matrix error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update permissions matrix.' });
  }
});

module.exports = router;
