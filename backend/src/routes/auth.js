const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const crypto = require('crypto');

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '1h';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// Helper: Query user roles and permissions
async function getUserRolesAndPermissions(userId) {
  const roles = await db('roles')
    .join('user_roles', 'roles.id', 'user_roles.role_id')
    .where('user_roles.user_id', userId)
    .select('roles.name');

  const permissions = await db('permissions')
    .join('role_permissions', 'permissions.id', 'role_permissions.permission_id')
    .join('user_roles', 'role_permissions.role_id', 'user_roles.role_id')
    .where('user_roles.user_id', userId)
    .select('permissions.code')
    .distinct();

  return {
    roles: roles.map(r => r.name),
    permissions: permissions.map(p => p.code)
  };
}

// 1. LOGIN API
router.post('/login', async (req, res) => {
  const loginIdentifier = (req.body.username || req.body.email || '').trim();
  const password = req.body.password;

  if (!loginIdentifier || !password) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Username/email and password are required.' });
  }

  try {
    const user = await db('users')
      .where(function() {
        this.where('username', loginIdentifier)
          .orWhere('email', loginIdentifier.toLowerCase());
      })
      .first();

    if (!user) {
      await logAudit(req, { action: 'Failed Login', module: 'Auth', notes: `Account not found: ${loginIdentifier}` });
      return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ success: false, error: 'USER_INACTIVE', message: 'Your account has been deactivated. Please contact an administrator.' });
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const lockTimeRemaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        success: false,
        error: 'ACCOUNT_LOCKED',
        message: `Account is temporarily locked. Please try again after ${lockTimeRemaining} minute(s).`
      });
    }

    // Verify Password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      // Increment login attempts
      const newAttempts = (user.login_attempts || 0) + 1;
      const updates = { login_attempts: newAttempts };
      let message = 'Invalid username/email or password.';

      if (newAttempts >= 5) {
        // Lock account for 15 minutes
        const lockDuration = 15 * 60 * 1000;
        updates.locked_until = new Date(Date.now() + lockDuration);
        message = 'Account locked due to 5 consecutive failed login attempts. Please try again in 15 minutes.';
        logger.warn(`User account locked: ${user.username}`);
      }

      await db('users').where('id', user.id).update(updates);
      await logAudit(req, { action: 'Failed Login', module: 'Auth', recordId: user.id, notes: `Incorrect password for user: ${user.username}` });

      return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message });
    }

    // Reset login attempts on success
    await db('users').where('id', user.id).update({
      login_attempts: 0,
      locked_until: null
    });

    // Get roles and permissions
    const { roles, permissions } = await getUserRolesAndPermissions(user.id);

    // Fetch employee details associated with user email (if any)
    const employee = await db('employees').where('email', user.email).first();
    const fullName = employee ? `${employee.first_name} ${employee.last_name}` : (user.username || user.email);

    // Create JWT payload
    const tokenPayload = {
      id: user.id,
      sub: user.id,
      username: user.username,
      email: user.email,
      name: fullName,
      fullName,
      role: roles[0] || 'STAFF',
      roles,
      permissions,
      employeeId: employee ? employee.id : null,
      forcePasswordChange: Boolean(user.force_password_change)
    };

    // Generate tokens
    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'super_secret_jwt_key_123456_nkb_itms', { expiresIn: ACCESS_EXPIRY });
    const refreshToken = jwt.sign({ id: user.id, sub: user.id }, process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_jwt_key_123456_nkb_itms', { expiresIn: REFRESH_EXPIRY });

    // Store refresh token in database
    await db('refresh_tokens').insert({
      user_id: user.id,
      token: refreshToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await logAudit(req, { action: 'Login', module: 'Auth', recordId: user.id });

    const userData = {
      id: user.id,
      sub: user.id,
      username: user.username,
      email: user.email,
      roles,
      role: roles[0] || 'STAFF',
      permissions,
      forcePasswordChange: Boolean(user.force_password_change),
      employeeId: employee ? employee.id : null,
      fullName
    };

    return res.json({
      success: true,
      message: 'Login successful.',
      token: accessToken,
      accessToken,
      refreshToken,
      user: userData,
      data: {
        token: accessToken,
        accessToken,
        refreshToken,
        user: userData
      }
    });

  } catch (err) {
    logger.error(`Login API error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
});

// 2. REFRESH TOKEN API
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token is required.' });
  }

  try {
    // Check if token exists in DB
    const dbToken = await db('refresh_tokens').where('token', refreshToken).first();
    if (!dbToken || new Date(dbToken.expires_at) < new Date()) {
      if (dbToken) await db('refresh_tokens').where('id', dbToken.id).del();
      return res.status(403).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    // Verify token
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_jwt_key_123456_nkb_itms', async (err, decoded) => {
      if (err) {
        return res.status(403).json({ success: false, message: 'Invalid refresh token.' });
      }

      const user = await db('users').where('id', decoded.id).first();
      if (!user || user.status === 'inactive') {
        return res.status(403).json({ success: false, message: 'User account is inactive or not found.' });
      }

      // Re-sign access token with updated permissions
      const { roles, permissions } = await getUserRolesAndPermissions(user.id);
      const employee = await db('employees').where('email', user.email).first();

      const tokenPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        roles,
        permissions,
        employeeId: employee ? employee.id : null,
        forcePasswordChange: user.force_password_change
      };

      const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'super_secret_jwt_key_123456_nkb_itms', { expiresIn: ACCESS_EXPIRY });

      return res.json({
        success: true,
        message: 'Token refreshed successfully.',
        data: { accessToken }
      });
    });

  } catch (err) {
    logger.error(`Refresh token error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// 3. LOGOUT API
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (refreshToken) {
      await db('refresh_tokens').where('token', refreshToken).del();
    }
    
    // Loose auth attempt for audit logging
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_123456_nkb_itms');
        const reqWithUser = { ...req, user: decoded };
        await logAudit(reqWithUser, { action: 'Logout', module: 'Auth', recordId: decoded.id });
      } catch (e) {
        // Suppress verification errors during logout log attempt
      }
    }

    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    logger.error(`Logout error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error during logout.' });
  }
});

// 4. GET ME PROFILE API
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where('id', req.user.id).first();
    if (!user) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'User profile not found.' });
    }

    const { roles, permissions } = await getUserRolesAndPermissions(user.id);
    const employee = await db('employees').where('email', user.email).first();
    const fullName = employee ? `${employee.first_name} ${employee.last_name}` : (user.username || user.email);

    const payload = {
      id: user.id,
      sub: user.id,
      username: user.username,
      email: user.email,
      roles,
      role: roles[0] || 'STAFF',
      permissions,
      forcePasswordChange: Boolean(user.force_password_change),
      employeeId: employee ? employee.id : null,
      fullName
    };

    return res.json({
      success: true,
      ...payload,
      data: payload
    });
  } catch (err) {
    logger.error(`Get profile error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// Update profile
router.patch('/me', authenticateToken, async (req, res) => {
  try {
    const { fullName, email } = req.body;
    const user = await db('users').where('id', req.user.id).first();
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' });

    if (email && email !== user.email) {
      await db('users').where('id', user.id).update({ email: email.toLowerCase() });
    }

    const employee = await db('employees').where('email', user.email).first();
    if (employee && fullName) {
      const parts = fullName.trim().split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || firstName;
      await db('employees').where('id', employee.id).update({ first_name: firstName, last_name: lastName });
    }

    const { roles } = await getUserRolesAndPermissions(user.id);
    return res.json({
      success: true,
      id: user.id,
      email: email || user.email,
      fullName: fullName || user.username,
      role: roles[0] || 'STAFF'
    });
  } catch (err) {
    logger.error(`Update profile error: ${err.message}`);
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.patch('/me/password', authenticateToken, async (req, res) => {
  const currentPassword = req.body.currentPassword || req.body.oldPassword;
  const newPassword = req.body.newPassword;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Current and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters long.' });
  }

  try {
    const user = await db('users').where('id', req.user.id).first();
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db('users').where('id', user.id).update({
      password_hash: passwordHash,
      force_password_change: false,
      updated_at: new Date()
    });

    await logAudit(req, { action: 'Change Password', module: 'Auth', recordId: user.id });
    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// 5. CHANGE PASSWORD API
router.post('/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both old and new passwords are required.' });
  }

  try {
    const user = await db('users').where('id', req.user.id).first();
    const passwordMatch = await bcrypt.compare(oldPassword, user.password_hash);

    if (!passwordMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect old password.' });
    }

    // Basic password complexity validation
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db('users').where('id', user.id).update({
      password_hash: hashedPassword,
      force_password_change: false,
      updated_at: new Date()
    });

    await logAudit(req, { action: 'Change Password', module: 'Auth', recordId: user.id });

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    logger.error(`Change password error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// 6. FORCE CHANGE PASSWORD (FIRST-TIME LOGIN)
router.post('/force-change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  if (!username || !oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Username, old password, and new password are required.' });
  }

  try {
    const user = await db('users').where('username', username).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const passwordMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect old password.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db('users').where('id', user.id).update({
      password_hash: hashedPassword,
      force_password_change: false,
      updated_at: new Date()
    });

    const fakeReq = { user: { id: user.id, username: user.username }, ip: req.ip, headers: req.headers };
    await logAudit(fakeReq, { action: 'Force Change Password', module: 'Auth', recordId: user.id });

    return res.json({ success: true, message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    logger.error(`Force password change error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// 7. FORGOT PASSWORD API (GENERATE RESET TOKEN)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required.' });
  }

  try {
    const user = await db('users').where('email', email).first();
    if (!user) {
      // For security, do not disclose if email does not exist; return generic success message
      return res.json({ success: true, message: 'If the email matches an active account, a reset link will be sent.' });
    }

    // Generate random reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour expiry

    // Delete any existing reset tokens
    await db('password_reset_tokens').where('user_id', user.id).del();

    // Insert new reset token
    await db('password_reset_tokens').insert({
      user_id: user.id,
      token: token,
      expires_at: expiry
    });

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    logger.info(`Password reset link generated for ${email}: ${resetLink}`);
    
    // Note: If email is configured, nodemailer would send it. We've logged it here so it can be used for local testing.
    // In production, nodemailer would mail this link.

    return res.json({
      success: true,
      message: 'If the email matches an active account, a reset link will be sent.',
      // For development ease, we return the token in non-production environments to allow testing easily
      token: process.env.NODE_ENV === 'development' ? token : undefined
    });

  } catch (err) {
    logger.error(`Forgot password error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// 8. RESET PASSWORD API
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: 'Token and new password are required.' });
  }

  try {
    const resetRecord = await db('password_reset_tokens').where('token', token).first();

    if (!resetRecord || new Date(resetRecord.expires_at) < new Date()) {
      if (resetRecord) await db('password_reset_tokens').where('id', resetRecord.id).del();
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in transaction
    await db.transaction(async (trx) => {
      await trx('users').where('id', resetRecord.user_id).update({
        password_hash: hashedPassword,
        force_password_change: false,
        updated_at: new Date()
      });
      // Delete token
      await trx('password_reset_tokens').where('id', resetRecord.id).del();
    });

    const user = await db('users').where('id', resetRecord.user_id).first();
    const fakeReq = { user: { id: user.id, username: user.username }, ip: req.ip, headers: req.headers };
    await logAudit(fakeReq, { action: 'Reset Password', module: 'Auth', recordId: user.id });

    return res.json({ success: true, message: 'Password has been reset successfully.' });

  } catch (err) {
    logger.error(`Reset password error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

module.exports = router;
