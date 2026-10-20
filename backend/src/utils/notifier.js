const db = require('../config/db');
const socket = require('./socket');
const logger = require('./logger');
const nodemailer = require('nodemailer');

// Set up transporter based on env variables
let mailTransporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  logger.info('SMTP Mail Transporter configured successfully.');
} else {
  logger.info('SMTP host/credentials not fully configured. Email notifications will be disabled.');
}

/**
 * Creates and dispatches a notification to a specific user (In-app + Socket.IO + Email)
 * 
 * @param {number} userId - Target User ID
 * @param {Object} details - Notification details
 * @param {string} details.title - Short summary title
 * @param {string} details.message - Long description text
 * @param {string} [details.type] - Info, Warning, Error, Success
 * @param {number} [details.relatedRecordId] - Primary key of the related transaction/ticket/asset
 * @param {string} [details.relatedModule] - Target module name
 */
async function sendNotification(userId, { title, message, type = 'Info', relatedRecordId = null, relatedModule = null }) {
  try {
    // 1. Write notification record to database
    const [notificationId] = await db('notifications').insert({
      user_id: userId,
      title: title,
      message: message,
      type: type,
      is_read: false,
      related_record_id: relatedRecordId,
      related_module: relatedModule,
      created_at: new Date()
    });

    // 2. Emit real-time notification via Socket.IO
    socket.notifyUser(userId, {
      id: notificationId,
      title,
      message,
      type,
      is_read: false,
      related_record_id: relatedRecordId,
      related_module: relatedModule,
      created_at: new Date()
    });

    // 3. Send optional email notification
    if (mailTransporter) {
      // Find the user's email address
      const user = await db('users').where('id', userId).select('email', 'username').first();
      if (user && user.email) {
        const mailOptions = {
          from: process.env.SMTP_FROM || 'noreply@nkb-itms.com',
          to: user.email,
          subject: `[NKB-ITMS] ${title}`,
          text: `Hello ${user.username},\n\nThis is an automated notification from NKB IT Management System:\n\n${message}\n\nBest Regards,\nNKB IT Team`,
          html: `<p>Hello <b>${user.username}</b>,</p>
                 <p>This is an automated notification from NKB IT Management System:</p>
                 <p style="background-color: #f1f5f9; padding: 12px; border-left: 4px solid #0f172a; margin: 16px 0;">
                   <b>${title}</b><br/>
                   ${message}
                 </p>
                 <p>Best Regards,<br/>NKB IT Team</p>`
        };

        // Send email asynchronously and catch errors silently
        mailTransporter.sendMail(mailOptions, (mailErr, info) => {
          if (mailErr) {
            logger.warn(`Failed to send email notification to ${user.email}: ${mailErr.message}`);
          } else {
            logger.debug(`Email notification sent to ${user.email}: ${info.messageId}`);
          }
        });
      }
    }
  } catch (err) {
    logger.error(`Error in sendNotification dispatcher: ${err.message}`);
  }
}

/**
 * Creates and dispatches a notification to all users holding a specific role
 * 
 * @param {string} roleName - Name of target role (e.g. 'IT Staff', 'Technician')
 * @param {Object} details - Notification details
 */
async function sendNotificationToRole(roleName, details) {
  try {
    // Find all users belonging to this role
    const usersInRole = await db('users')
      .join('user_roles', 'users.id', 'user_roles.user_id')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('roles.name', roleName)
      .andWhere('users.status', 'active')
      .select('users.id');

    for (const user of usersInRole) {
      await sendNotification(user.id, details);
    }
  } catch (err) {
    logger.error(`Error in sendNotificationToRole: ${err.message}`);
  }
}

module.exports = {
  sendNotification,
  sendNotificationToRole
};
