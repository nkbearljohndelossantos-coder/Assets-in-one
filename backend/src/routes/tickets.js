const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { getNextNumber } = require('../utils/numberSequence');
const { uploadDocument } = require('../utils/uploader');
const { sendNotification } = require('../utils/notifier');
const fs = require('fs');
const path = require('path');

// Helper: Check if user is IT staff or Technician
const isITPersonnel = (user) => {
  const itRoles = ['Super Admin', 'IT Manager', 'IT Staff', 'Technician'];
  return user.roles && user.roles.some(role => itRoles.includes(role));
};

// ==========================================
// 1. TICKETS RETRIEVAL (List)
// ==========================================
router.get('/', authenticateToken, async (req, res) => {
  const { page = 1, limit = 10, search = '', categoryId = '', status = '', priority = '', technicianId = '' } = req.query;

  try {
    const query = db('tickets')
      .join('employees as requester', 'tickets.requested_by_employee_id', 'requester.id')
      .join('departments', 'tickets.department_id', 'departments.id')
      .join('ticket_categories', 'tickets.category_id', 'ticket_categories.id')
      .leftJoin('users as tech', 'tickets.assigned_technician_id', 'tech.id')
      .select(
        'tickets.*',
        'ticket_categories.name as category_name',
        'departments.name as department_name',
        db.raw("concat(requester.first_name, ' ', requester.last_name) as requested_by_name"),
        'tech.username as assigned_technician_name'
      );

    // Security check: Standard employees can ONLY see their own tickets
    if (!isITPersonnel(req.user)) {
      if (!req.user.employeeId) {
        return res.json({ success: true, data: { tickets: [], pagination: { total: 0, page: 1, limit: 10, pages: 0 } } });
      }
      query.where('tickets.requested_by_employee_id', req.user.employeeId);
    } else {
      // IT Personnel can filter by technician
      if (technicianId) {
        query.where('tickets.assigned_technician_id', technicianId);
      }
    }

    // Apply general filters
    if (search) {
      query.where((builder) => {
        builder.where('tickets.ticket_number', 'like', `%${search}%`)
          .orWhere('tickets.subject', 'like', `%${search}%`)
          .orWhere('tickets.description', 'like', `%${search}%`);
      });
    }

    if (categoryId) query.where('tickets.category_id', categoryId);
    if (status) query.where('tickets.status', status);
    if (priority) query.where('tickets.priority', priority);

    // Total Count
    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    // Paginated results
    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('tickets.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return res.json({
      success: true,
      data: {
        tickets: data,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (err) {
    logger.error(`Get tickets error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve tickets.' });
  }
});

// ==========================================
// 2. TICKET PROFILE / DETAILS
// ==========================================
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const ticket = await db('tickets')
      .join('employees as requester', 'tickets.requested_by_employee_id', 'requester.id')
      .join('departments', 'tickets.department_id', 'departments.id')
      .join('ticket_categories', 'tickets.category_id', 'ticket_categories.id')
      .leftJoin('users as tech', 'tickets.assigned_technician_id', 'tech.id')
      .leftJoin('assets', 'tickets.related_asset_id', 'assets.id')
      .select(
        'tickets.*',
        'ticket_categories.name as category_name',
        'departments.name as department_name',
        db.raw("concat(requester.first_name, ' ', requester.last_name) as requested_by_name"),
        'tech.username as assigned_technician_name',
        'assets.name as asset_name',
        'assets.asset_code as asset_code'
      )
      .where('tickets.id', id)
      .first();

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    // Security check: Employee can only view their own ticket details
    if (!isITPersonnel(req.user) && ticket.requested_by_employee_id !== req.user.employeeId) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own tickets.' });
    }

    // Public Comments
    const comments = await db('ticket_comments')
      .join('users', 'ticket_comments.user_id', 'users.id')
      .leftJoin('employees', 'users.email', 'employees.email')
      .select(
        'ticket_comments.*',
        'users.username',
        db.raw("concat(employees.first_name, ' ', employees.last_name) as user_full_name")
      )
      .where('ticket_comments.ticket_id', id)
      .orderBy('ticket_comments.created_at', 'asc');

    // Attachments
    const attachments = await db('ticket_attachments').where('ticket_id', id);

    // History Timeline
    const history = await db('ticket_history')
      .leftJoin('users', 'ticket_history.performed_by', 'users.id')
      .select('ticket_history.*', 'users.username as performed_by_username')
      .where('ticket_history.ticket_id', id)
      .orderBy('ticket_history.created_at', 'desc');

    // Time logs (IT personnel only)
    let timeLogs = [];
    if (isITPersonnel(req.user)) {
      timeLogs = await db('ticket_time_logs')
        .join('users', 'ticket_time_logs.technician_id', 'users.id')
        .select('ticket_time_logs.*', 'users.username as technician_username')
        .where('ticket_time_logs.ticket_id', id)
        .orderBy('ticket_time_logs.created_at', 'desc');
    }

    // Internal Notes (Restricted: Employee MUST not see internal notes)
    let internalNotes = [];
    if (isITPersonnel(req.user)) {
      internalNotes = await db('ticket_internal_notes')
        .join('users', 'ticket_internal_notes.user_id', 'users.id')
        .select('ticket_internal_notes.*', 'users.username')
        .where('ticket_internal_notes.ticket_id', id)
        .orderBy('ticket_internal_notes.created_at', 'asc');
    }

    return res.json({
      success: true,
      data: {
        ticket,
        comments,
        attachments,
        history,
        timeLogs,
        internalNotes
      }
    });

  } catch (err) {
    logger.error(`Get ticket details error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve ticket details.' });
  }
});

// ==========================================
// 3. CREATE TICKET
// ==========================================
router.post('/', authenticateToken, uploadDocument.single('screenshot'), async (req, res) => {
  const { categoryId, subject, description, priority, relatedAssetId } = req.body;

  if (!categoryId || !subject || !description) {
    return res.status(400).json({ success: false, message: 'Category, Subject, and Description are required.' });
  }

  // Ensure user is linked to an employee profile to file a ticket
  if (!req.user.employeeId) {
    return res.status(400).json({ success: false, message: 'Your account is not linked to an employee profile. Tickets can only be filed by registered employees.' });
  }

  try {
    const employee = await db('employees').where('id', req.user.employeeId).first();
    const screenshotPath = req.file ? `/uploads/documents/${req.file.filename}` : null;

    let newTicketId;
    let ticketNum;

    await db.transaction(async (trx) => {
      // 1. Generate unique ticket number
      ticketNum = await getNextNumber('Ticket', trx);

      // 2. Insert Ticket
      const [id] = await trx('tickets').insert({
        ticket_number: ticketNum,
        requested_by_employee_id: employee.id,
        department_id: employee.department_id,
        category_id: categoryId,
        subject: subject,
        description: description,
        priority: priority || 'Medium',
        status: 'Open',
        screenshot_path: screenshotPath,
        created_at: new Date(),
        updated_at: new Date()
      });
      newTicketId = id;

      // 3. Log history timeline
      await trx('ticket_history').insert({
        ticket_id: newTicketId,
        action: 'Create',
        new_status: 'Open',
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    const newTicket = await db('tickets').where('id', newTicketId).first();
    await logAudit(req, { action: 'Create Ticket', module: 'Tickets', recordId: newTicketId, newValues: newTicket });

    return res.json({
      success: true,
      message: 'Help desk ticket filed successfully.',
      data: newTicket
    });

  } catch (err) {
    logger.error(`Create ticket error: ${err.message}`);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ success: false, message: 'Failed to file ticket.' });
  }
});

// ==========================================
// 4. ASSIGN TECHNICIAN
// ==========================================
router.post('/:id/assign', authenticateToken, requirePermission('tickets.assign'), async (req, res) => {
  const { id } = req.params;
  const { technicianId } = req.body; // User ID of technician

  if (!technicianId) {
    return res.status(400).json({ success: false, message: 'Technician user ID is required.' });
  }

  try {
    const ticket = await db('tickets').where('id', id).first();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const technician = await db('users').where('id', technicianId).first();
    if (!technician) return res.status(404).json({ success: false, message: 'Technician account not found.' });

    // Determine status (move from Open to Assigned on initial technician assign)
    const newStatus = ticket.status === 'Open' ? 'Assigned' : ticket.status;

    await db.transaction(async (trx) => {
      await trx('tickets').where('id', id).update({
        assigned_technician_id: technicianId,
        status: newStatus,
        updated_at: new Date()
      });

      // Write Timeline
      await trx('ticket_history').insert({
        ticket_id: id,
        action: 'Assign Technician',
        old_status: ticket.status,
        new_status: newStatus,
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    // Notify technician in real-time
    await sendNotification(technicianId, {
      title: 'Ticket Assigned',
      message: `Helpdesk ticket ${ticket.ticket_number} "${ticket.subject}" has been assigned to you.`,
      type: 'Info',
      relatedRecordId: id,
      relatedModule: 'Tickets'
    });

    const updatedTicket = await db('tickets').where('id', id).first();
    await logAudit(req, { action: 'Assign Ticket', module: 'Tickets', recordId: id, newValues: { assigned_technician_id: technicianId, status: newStatus } });

    return res.json({ success: true, message: `Ticket assigned to technician ${technician.username} successfully.`, data: updatedTicket });

  } catch (err) {
    logger.error(`Assign technician error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to assign technician.' });
  }
});

// ==========================================
// 5. UPDATE TICKET DETAILS (Status, Priority, Resolution)
// ==========================================
router.put('/:id', authenticateToken, requirePermission('tickets.update'), async (req, res) => {
  const { id } = req.params;
  const { status, priority, dueDate, resolutionSummary, rootCause, relatedAssetId } = req.body;

  try {
    const ticket = await db('tickets').where('id', id).first();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    // Check if status is Resolved, verify resolution fields
    if (status === 'Resolved' && (!resolutionSummary || !rootCause)) {
      return res.status(400).json({ success: false, message: 'Ticket resolution could not be saved without a Resolution Summary and Root Cause.' });
    }

    // Check if status is Closed, employee owner validation is handled in closing route or allowed for admins
    if (status === 'Closed' && ticket.status !== 'Resolved') {
      return res.status(400).json({ success: false, message: 'Tickets must be set to Resolved before they can be officially Closed.' });
    }

    const updates = {
      priority: priority || ticket.priority,
      due_date: dueDate !== undefined ? dueDate : ticket.due_date,
      related_asset_id: relatedAssetId !== undefined ? relatedAssetId : ticket.related_asset_id,
      updated_at: new Date()
    };

    if (status && status !== ticket.status) {
      updates.status = status;
      if (status === 'Resolved') {
        updates.resolution_summary = resolutionSummary;
        updates.root_cause = rootCause;
        updates.resolution_date = new Date();
      }
      if (status === 'Closed') {
        updates.closed_date = new Date();
      }
    }

    await db.transaction(async (trx) => {
      await trx('tickets').where('id', id).update(updates);

      // Log to history timeline if status changed
      if (status && status !== ticket.status) {
        await trx('ticket_history').insert({
          ticket_id: id,
          action: `Status Change: ${status}`,
          old_status: ticket.status,
          new_status: status,
          performed_by: req.user.id,
          created_at: new Date()
        });
      }
    });

    // Notify requester if status updated
    if (status && status !== ticket.status) {
      const requesterUser = await db('users').join('employees', 'users.email', 'employees.email').where('employees.id', ticket.requested_by_employee_id).select('users.id').first();
      if (requesterUser) {
        await sendNotification(requesterUser.id, {
          title: `Ticket Status Update`,
          message: `Your ticket ${ticket.ticket_number} is now: ${status}.`,
          type: status === 'Resolved' ? 'Success' : 'Info',
          relatedRecordId: id,
          relatedModule: 'Tickets'
        });
      }
    }

    const updatedTicket = await db('tickets').where('id', id).first();
    await logAudit(req, { action: 'Update Ticket', module: 'Tickets', recordId: id, oldValues: ticket, newValues: updatedTicket });

    return res.json({ success: true, message: 'Ticket updated successfully.', data: updatedTicket });

  } catch (err) {
    logger.error(`Update ticket error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update ticket.' });
  }
});

// ==========================================
// 6. CLIENT FEEDBACK & CLOSE TICKET
// ==========================================
router.post('/:id/close', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { rating, feedback } = req.body;

  if (rating === undefined || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'A rating between 1 and 5 stars is required to close the ticket.' });
  }

  try {
    const ticket = await db('tickets').where('id', id).first();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    // Validate requester owns ticket
    if (!isITPersonnel(req.user) && ticket.requested_by_employee_id !== req.user.employeeId) {
      return res.status(403).json({ success: false, message: 'Only the requesting employee can provide feedback and close this ticket.' });
    }

    if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
      return res.status(400).json({ success: false, message: 'This ticket has not been marked as Resolved yet.' });
    }

    await db.transaction(async (trx) => {
      await trx('tickets').where('id', id).update({
        status: 'Closed',
        user_rating: rating,
        user_feedback: feedback || null,
        closed_date: new Date(),
        updated_at: new Date()
      });

      await trx('ticket_history').insert({
        ticket_id: id,
        action: 'Close and Rate',
        old_status: ticket.status,
        new_status: 'Closed',
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    const closedTicket = await db('tickets').where('id', id).first();
    await logAudit(req, { action: 'Close Ticket', module: 'Tickets', recordId: id, newValues: closedTicket });

    return res.json({ success: true, message: 'Ticket closed. Thank you for your feedback!', data: closedTicket });

  } catch (err) {
    logger.error(`Close ticket error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to close ticket.' });
  }
});

// ==========================================
// 7. PUBLIC COMMENTS
// ==========================================
router.post('/:id/comments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  if (!comment) return res.status(400).json({ success: false, message: 'Comment content is required.' });

  try {
    const ticket = await db('tickets').where('id', id).first();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    // Security check
    if (!isITPersonnel(req.user) && ticket.requested_by_employee_id !== req.user.employeeId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [commentId] = await db('ticket_comments').insert({
      ticket_id: id,
      user_id: req.user.id,
      comment: comment,
      created_at: new Date()
    });

    // Notify other party
    let recipientUserId = null;
    if (req.user.id === ticket.assigned_technician_id) {
      // Tech commented: notify requester
      const requester = await db('users').join('employees', 'users.email', 'employees.email').where('employees.id', ticket.requested_by_employee_id).select('users.id').first();
      if (requester) recipientUserId = requester.id;
    } else if (req.user.employeeId === ticket.requested_by_employee_id) {
      // Requester commented: notify assigned tech
      if (ticket.assigned_technician_id) recipientUserId = ticket.assigned_technician_id;
    }

    if (recipientUserId) {
      await sendNotification(recipientUserId, {
        title: 'New Ticket Comment',
        message: `A new comment has been posted on ticket ${ticket.ticket_number} by ${req.user.username}.`,
        type: 'Info',
        relatedRecordId: id,
        relatedModule: 'Tickets'
      });
    }

    const newCommentObj = await db('ticket_comments').where('id', commentId).first();
    return res.json({ success: true, message: 'Comment posted successfully.', data: newCommentObj });

  } catch (err) {
    logger.error(`Post comment error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to post comment.' });
  }
});

// ==========================================
// 8. INTERNAL NOTES (IT PERSONNEL ONLY)
// ==========================================
router.post('/:id/internal-notes', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  if (!note) return res.status(400).json({ success: false, message: 'Note content is required.' });

  if (!isITPersonnel(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden. Only IT personnel can add internal notes.' });
  }

  try {
    const ticket = await db('tickets').where('id', id).first();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const [noteId] = await db('ticket_internal_notes').insert({
      ticket_id: id,
      user_id: req.user.id,
      note: note,
      created_at: new Date()
    });

    const newNoteObj = await db('ticket_internal_notes').where('id', noteId).first();
    return res.json({ success: true, message: 'Internal note saved successfully.', data: newNoteObj });

  } catch (err) {
    logger.error(`Post internal note error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to save internal note.' });
  }
});

// ==========================================
// 9. TIME LOGS (IT PERSONNEL ONLY)
// ==========================================
router.post('/:id/time-logs', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { startTime, endTime, remarks } = req.body;

  if (!startTime || !endTime) {
    return res.status(400).json({ success: false, message: 'Start time and End time are required.' });
  }

  if (!isITPersonnel(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden. Only IT personnel can log work durations.' });
  }

  try {
    const ticket = await db('tickets').where('id', id).first();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;

    if (diffMs <= 0) {
      return res.status(400).json({ success: false, message: 'End time must be after Start time.' });
    }

    const durationMinutes = Math.round(diffMs / 60000);

    const [logId] = await db('ticket_time_logs').insert({
      ticket_id: id,
      technician_id: req.user.id,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      remarks: remarks || null,
      created_at: new Date()
    });

    const newLogObj = await db('ticket_time_logs').where('id', logId).first();
    await logAudit(req, { action: 'Log Ticket Time', module: 'Tickets', recordId: logId, newValues: newLogObj });

    return res.json({ success: true, message: 'Labor duration logged successfully.', data: newLogObj });

  } catch (err) {
    logger.error(`Post ticket time log error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to save time log.' });
  }
});

module.exports = router;
