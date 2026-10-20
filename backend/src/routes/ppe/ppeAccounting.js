const express = require('express');
const dayjs = require('dayjs');
const { z } = require('zod');
const db = require('../../config/db');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/auditLogger');
const { calcStraightLine, money } = require('../../utils/depreciation');

const ppeAccountingRouter = express.Router();

const accountSchema = z.object({
  code: z.string().min(1, 'Account code is required'),
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  description: z.string().optional().nullable(),
  balance: z.preprocess((v) => (v ? Number(v) : 0), z.number().default(0))
});

const journalLineSchema = z.object({
  accountId: z.number().int().positive('Valid account ID is required'),
  debit: z.preprocess((v) => (v ? Number(v) : 0), z.number().nonnegative().default(0)),
  credit: z.preprocess((v) => (v ? Number(v) : 0), z.number().nonnegative().default(0)),
  description: z.string().optional().nullable()
});

const journalEntrySchema = z.object({
  entryDate: z.string().min(4, 'Valid entry date is required'),
  reference: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  lines: z.array(journalLineSchema).min(2, 'At least two journal lines are required for double-entry bookkeeping')
});

// 1. GET CHART OF ACCOUNTS (GL ACCOUNTS)
ppeAccountingRouter.get('/accounts', authenticateToken, async (req, res, next) => {
  try {
    const accounts = await db('ppe_gl_accounts').orderBy('code', 'asc');
    return res.json({ success: true, count: accounts.length, data: accounts });
  } catch (err) {
    return next(err);
  }
});

// 2. CREATE GL ACCOUNT
ppeAccountingRouter.post('/accounts', authenticateToken, requireRole('ADMIN', 'Super Admin', 'IT Manager'), async (req, res, next) => {
  try {
    const input = accountSchema.parse(req.body);

    const existing = await db('ppe_gl_accounts').where('code', input.code).first();
    if (existing) {
      return res.status(400).json({ error: 'DUPLICATE_CODE', message: `Account code ${input.code} already exists.` });
    }

    const [id] = await db('ppe_gl_accounts').insert({
      code: input.code,
      name: input.name,
      type: input.type,
      description: input.description || null,
      balance: input.balance || 0,
    });

    const created = await db('ppe_gl_accounts').where('id', id).first();
    await logAudit(req, {
      action: 'Create GL Account',
      module: 'PPE Accounting',
      recordId: id,
      newValues: created
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', issues: err.issues });
    }
    return next(err);
  }
});

// 3. GET JOURNAL ENTRIES
ppeAccountingRouter.get('/journals', authenticateToken, async (req, res, next) => {
  try {
    const { from, to, status } = req.query;

    let query = db('ppe_journal_entries as j')
      .leftJoin('users as u', 'j.created_by', 'u.id')
      .select('j.*', 'u.username as created_by_username');

    if (status) query = query.where('j.status', status);
    if (from) query = query.where('j.entry_date', '>=', from);
    if (to) query = query.where('j.entry_date', '<=', to);

    const journals = await query.orderBy('j.entry_date', 'desc').orderBy('j.id', 'desc');
    return res.json({ success: true, count: journals.length, data: journals });
  } catch (err) {
    return next(err);
  }
});

// 4. GET SINGLE JOURNAL ENTRY WITH LINES
ppeAccountingRouter.get('/journals/:id', authenticateToken, async (req, res, next) => {
  try {
    const id = req.params.id;
    const journal = await db('ppe_journal_entries as j')
      .leftJoin('users as u', 'j.created_by', 'u.id')
      .where('j.id', id)
      .select('j.*', 'u.username as created_by_username')
      .first();

    if (!journal) return res.status(404).json({ error: 'NOT_FOUND', message: 'Journal entry not found' });

    const lines = await db('ppe_journal_lines as l')
      .leftJoin('ppe_gl_accounts as a', 'l.account_id', 'a.id')
      .where('l.journal_id', id)
      .select('l.*', 'a.code as account_code', 'a.name as account_name', 'a.type as account_type')
      .orderBy('l.id', 'asc');

    return res.json({
      success: true,
      data: {
        ...journal,
        lines
      }
    });
  } catch (err) {
    return next(err);
  }
});

// 5. POST MANUAL DOUBLE-ENTRY JOURNAL ENTRY
ppeAccountingRouter.post('/journals', authenticateToken, requireRole('ADMIN', 'Super Admin', 'IT Manager'), async (req, res, next) => {
  try {
    const input = journalEntrySchema.parse(req.body);

    // Verify double-entry balancing: totalDebits === totalCredits
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of input.lines) {
      const d = money(line.debit);
      const c = money(line.credit);
      if (d === 0 && c === 0) {
        return res.status(400).json({ error: 'INVALID_LINE', message: 'Each line must have a non-zero debit or credit amount.' });
      }
      totalDebit += d;
      totalCredit += c;
    }

    totalDebit = money(totalDebit);
    totalCredit = money(totalCredit);

    // Double-entry balancing enforcement
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return res.status(400).json({
        error: 'UNBALANCED_JOURNAL',
        message: `Double-entry journal is unbalanced! Total Debits: ${totalDebit}, Total Credits: ${totalCredit}. Difference must be 0.00.`
      });
    }

    // Generate unique entry number: JV-YYYYMM-XXXX
    const yearMonth = dayjs(input.entryDate).format('YYYYMM');
    const countRow = await db('ppe_journal_entries')
      .where('entry_number', 'like', `JV-${yearMonth}-%`)
      .count('id as count')
      .first();
    const seq = (Number(countRow?.count) || 0) + 1;
    const entryNumber = `JV-${yearMonth}-${String(seq).padStart(4, '0')}`;

    let journalId;
    await db.transaction(async (trx) => {
      // 1. Insert header
      const [id] = await trx('ppe_journal_entries').insert({
        entry_number: entryNumber,
        entry_date: input.entryDate,
        reference: input.reference || null,
        description: input.description,
        total_debit: totalDebit,
        total_credit: totalCredit,
        status: 'POSTED',
        created_by: req.user.id || null,
      });
      journalId = id;

      // 2. Insert lines and update account balances
      for (const line of input.lines) {
        const d = money(line.debit);
        const c = money(line.credit);

        await trx('ppe_journal_lines').insert({
          journal_id: journalId,
          account_id: line.accountId,
          debit: d,
          credit: c,
          description: line.description || input.description,
        });

        // Update GL account balance based on normal account balances
        const acc = await trx('ppe_gl_accounts').where('id', line.accountId).first();
        if (acc) {
          let delta = 0;
          if (['ASSET', 'EXPENSE'].includes(acc.type)) {
            delta = d - c; // Debit increases, credit decreases
          } else {
            delta = c - d; // Credit increases, debit decreases
          }
          await trx('ppe_gl_accounts')
            .where('id', line.accountId)
            .update({ balance: money(Number(acc.balance) + delta) });
        }
      }
    });

    const created = await db('ppe_journal_entries').where('id', journalId).first();
    await logAudit(req, {
      action: 'Post Journal Entry',
      module: 'PPE Accounting',
      recordId: journalId,
      notes: `Journal ${entryNumber} posted for PHP ${totalDebit}`
    });

    return res.status(201).json({ success: true, message: 'Journal entry posted successfully', data: created });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', issues: err.issues });
    }
    return next(err);
  }
});

// 6. AUTOMATED MONTHLY DEPRECIATION RUN & JOURNAL POSTING
ppeAccountingRouter.post('/post-depreciation', authenticateToken, requireRole('ADMIN', 'Super Admin', 'IT Manager'), async (req, res, next) => {
  try {
    const { year, month } = req.body;
    const targetYear = Number(year || new Date().getFullYear());
    const targetMonth = Number(month || (new Date().getMonth() + 1));
    const periodKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const periodEnd = dayjs(`${periodKey}-01`).endOf('month').format('YYYY-MM-DD');

    // 1. Check for duplicate journal posting for this period
    const existingEntry = await db('ppe_journal_entries')
      .where('reference', `Depreciation Run - ${periodKey}`)
      .where('status', 'POSTED')
      .first();

    if (existingEntry) {
      return res.status(409).json({
        error: 'DUPLICATE_POSTING',
        message: `Depreciation journal for period ${periodKey} is already posted (${existingEntry.entry_number}).`
      });
    }

    // 2. Find GL accounts for depreciation:
    // Debit: 6500 (Depreciation Expense - PPE)
    // Credit: 1590 (Accumulated Depreciation - PPE)
    let expenseAcc = await db('ppe_gl_accounts').where('code', '6500').first();
    let accumAcc = await db('ppe_gl_accounts').where('code', '1590').first();

    if (!expenseAcc) {
      const [id] = await db('ppe_gl_accounts').insert({
        code: '6500',
        name: 'Depreciation Expense - PPE',
        type: 'EXPENSE',
        balance: 0
      });
      expenseAcc = { id, code: '6500' };
    }
    if (!accumAcc) {
      const [id] = await db('ppe_gl_accounts').insert({
        code: '1590',
        name: 'Accumulated Depreciation - PPE',
        type: 'ASSET',
        balance: 0
      });
      accumAcc = { id, code: '1590' };
    }

    // 3. Calculate total monthly depreciation across all active PPE assets
    const assets = await db('ppe_assets')
      .whereNull('deleted_at')
      .where('status', '!=', 'RETIRED')
      .select('*');

    let totalMonthlyDepreciation = 0;
    const targetStart = dayjs(`${periodKey}-01`).startOf('month');

    for (const a of assets) {
      const cost = Number(a.acquisition_cost) || 0;
      const salvage = Number(a.salvage_value) || 0;
      const lifeYears = Number(a.useful_life_years) || 0;
      const annual = lifeYears > 0 ? (cost - salvage) / lifeYears : 0;
      const monthlyDep = annual / 12;

      const purchase = dayjs(a.purchase_date).startOf('month');
      const end = purchase.add(lifeYears * 12, 'month');

      // Check if this month is within active depreciable period
      if (targetStart.isSameOrAfter(purchase) && targetStart.isBefore(end)) {
        totalMonthlyDepreciation += monthlyDep;
      }
    }

    totalMonthlyDepreciation = money(totalMonthlyDepreciation);

    if (totalMonthlyDepreciation <= 0) {
      return res.json({
        success: true,
        message: `Depreciation for period ${periodKey} is 0.00. No journal entry required.`,
        amount: 0
      });
    }

    // 4. Generate balanced journal entry
    const entryNumber = `JV-${periodKey.replace('-', '')}-DEP`;
    let journalId;

    await db.transaction(async (trx) => {
      const [id] = await trx('ppe_journal_entries').insert({
        entry_number: entryNumber,
        entry_date: periodEnd,
        reference: `Depreciation Run - ${periodKey}`,
        description: `Automated monthly straight-line depreciation for ${dayjs(periodEnd).format('MMMM YYYY')}`,
        total_debit: totalMonthlyDepreciation,
        total_credit: totalMonthlyDepreciation,
        status: 'POSTED',
        created_by: req.user.id || null,
      });
      journalId = id;

      // Line 1: Debit Depreciation Expense
      await trx('ppe_journal_lines').insert({
        journal_id: journalId,
        account_id: expenseAcc.id,
        debit: totalMonthlyDepreciation,
        credit: 0,
        description: `Monthly depreciation charge (${periodKey})`
      });

      // Line 2: Credit Accumulated Depreciation
      await trx('ppe_journal_lines').insert({
        journal_id: journalId,
        account_id: accumAcc.id,
        debit: 0,
        credit: totalMonthlyDepreciation,
        description: `Cumulative depreciation allowance (${periodKey})`
      });

      // Update balances
      await trx('ppe_gl_accounts')
        .where('id', expenseAcc.id)
        .increment('balance', totalMonthlyDepreciation);

      await trx('ppe_gl_accounts')
        .where('id', accumAcc.id)
        .decrement('balance', totalMonthlyDepreciation); // Contra-asset
    });

    const posted = await db('ppe_journal_entries').where('id', journalId).first();
    await logAudit(req, {
      action: 'Post Depreciation Journal',
      module: 'PPE Accounting',
      recordId: journalId,
      notes: `Depreciation of PHP ${totalMonthlyDepreciation} posted for ${periodKey}`
    });

    return res.status(201).json({
      success: true,
      message: `Successfully posted balanced depreciation journal for ${periodKey}`,
      data: posted
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = { ppeAccountingRouter };
