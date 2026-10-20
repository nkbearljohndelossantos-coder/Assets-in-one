const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // ==========================================
    // 1. STATS METRICS (COUNTS)
    // ==========================================
    
    // Assets by status counts
    const assetStats = await db('assets')
      .select('status')
      .count('* as count')
      .groupBy('status');
    
    const assetCounts = { Total: 0, Available: 0, Assigned: 0, UnderRepair: 0, Retired: 0 };
    assetStats.forEach(stat => {
      assetCounts.Total += parseInt(stat.count);
      if (stat.status === 'Available') assetCounts.Available = parseInt(stat.count);
      else if (stat.status === 'Assigned') assetCounts.Assigned = parseInt(stat.count);
      else if (stat.status === 'Under Repair') assetCounts.UnderRepair = parseInt(stat.count);
      else if (stat.status === 'Retired' || stat.status === 'Disposed') assetCounts.Retired += parseInt(stat.count);
    });

    // Tickets counts
    const ticketStats = await db('tickets')
      .select('status', 'priority')
      .count('* as count')
      .groupBy('status', 'priority');
    
    const ticketCounts = { Open: 0, HighPriority: 0, Overdue: 0, ResolvedThisMonth: 0 };
    
    // Calculate resolved this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ resolvedCount }] = await db('tickets')
      .whereIn('status', ['Resolved', 'Closed'])
      .andWhere('resolution_date', '>=', startOfMonth)
      .count('* as resolvedCount');
    ticketCounts.ResolvedThisMonth = parseInt(resolvedCount) || 0;

    // Calculate overdue tickets (due date passed and not resolved/closed)
    const [{ overdueCount }] = await db('tickets')
      .whereNotIn('status', ['Resolved', 'Closed', 'Cancelled'])
      .andWhere('due_date', '<', todayStr)
      .count('* as overdueCount');
    ticketCounts.Overdue = parseInt(overdueCount) || 0;

    ticketStats.forEach(stat => {
      if (['Open', 'Assigned', 'In Progress', 'Waiting for User', 'Waiting for Parts'].includes(stat.status)) {
        ticketCounts.Open += parseInt(stat.count);
      }
      if (['High', 'Critical'].includes(stat.priority) && !['Resolved', 'Closed', 'Cancelled'].includes(stat.status)) {
        ticketCounts.HighPriority += parseInt(stat.count);
      }
    });

    // Low stock spare parts count
    const [{ lowStockCount }] = await db('inventory_items')
      .whereRaw('current_quantity <= minimum_stock')
      .count('* as lowStockCount');

    // Expiring warranties count (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const limitStr = thirtyDaysFromNow.toISOString().split('T')[0];

    const [{ expiringWarranties }] = await db('assets')
      .where('warranty_end_date', '>=', todayStr)
      .andWhere('warranty_end_date', '<=', limitStr)
      .count('* as expiringWarranties');

    // Expiring software licenses count (within 30 days)
    const [{ expiringLicenses }] = await db('software_licenses')
      .where('expiration_date', '>=', todayStr)
      .andWhere('expiration_date', '<=', limitStr)
      .count('* as expiringLicenses');

    // Overdue maintenance count (scheduled date passed and not completed/cancelled)
    const [{ overduePM }] = await db('maintenance_schedules')
      .whereNotIn('status', ['Completed', 'Cancelled'])
      .andWhere('scheduled_date', '<', todayStr)
      .count('* as overduePM');

    // Total repair cost accumulated
    const [{ totalRepairCost }] = await db('repairs')
      .sum('total_repair_cost as total');

    // ==========================================
    // 2. RECENT RECORDS (LOGS)
    // ==========================================
    
    // Recent audit activities
    const recentActivities = await db('audit_logs')
      .select('id', 'username', 'action', 'module', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(6);

    // Recent tickets
    const recentTickets = await db('tickets')
      .join('employees as req', 'tickets.requested_by_employee_id', 'req.id')
      .select('tickets.id', 'tickets.ticket_number', 'tickets.subject', 'tickets.status', 'tickets.created_at', db.raw("(req.first_name || ' ' || req.last_name) as requester_name"))
      .orderBy('tickets.created_at', 'desc')
      .limit(5);

    // Recent assignments
    const recentAssignments = await db('asset_assignments')
      .join('assets', 'asset_assignments.asset_id', 'assets.id')
      .leftJoin('employees as emp', 'asset_assignments.employee_id', 'emp.id')
      .select('asset_assignments.id', 'asset_assignments.assignment_number', 'assets.name as asset_name', 'asset_assignments.date_assigned', db.raw("(emp.first_name || ' ' || emp.last_name) as employee_name"))
      .orderBy('asset_assignments.created_at', 'desc')
      .limit(5);

    // ==========================================
    // 3. CHARTS DATASET
    // ==========================================

    // Assets by category distribution
    const assetsByCategory = await db('assets')
      .join('asset_categories', 'assets.category_id', 'asset_categories.id')
      .select('asset_categories.name')
      .count('* as value')
      .groupBy('asset_categories.name');

    // Tickets by priority distribution
    const ticketsByPriority = await db('tickets')
      .whereNotIn('status', ['Resolved', 'Closed', 'Cancelled'])
      .select('priority as name')
      .count('* as value')
      .groupBy('priority');

    // Tickets by status distribution
    const ticketsByStatus = await db('tickets')
      .select('status as name')
      .count('* as value')
      .groupBy('status');

    // Monthly tickets trend (resolved vs opened in the last 6 months)
    const ticketTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-indexed

      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const [{ opened }] = await db('tickets')
        .where('created_at', '>=', monthStart)
        .andWhere('created_at', '<=', monthEnd)
        .count('* as opened');

      const [{ resolved }] = await db('tickets')
        .whereIn('status', ['Resolved', 'Closed'])
        .andWhere('resolution_date', '>=', monthStart)
        .andWhere('resolution_date', '<=', monthEnd)
        .count('* as resolved');

      const monthName = date.toLocaleString('default', { month: 'short' });
      ticketTrends.push({
        month: monthName,
        Opened: parseInt(opened) || 0,
        Resolved: parseInt(resolved) || 0
      });
    }

    // Monthly repair costs (last 6 months)
    const repairTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth();

      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const [{ cost }] = await db('repairs')
        .where('repair_completion_date', '>=', monthStart)
        .andWhere('repair_completion_date', '<=', monthEnd)
        .andWhere('status', 'Completed')
        .sum('total_repair_cost as cost');

      const monthName = date.toLocaleString('default', { month: 'short' });
      repairTrends.push({
        month: monthName,
        Cost: parseFloat(cost) || 0
      });
    }

    // ==========================================
    // 4. ADDITIONAL IT OPERATIONS & PPE MODULES
    // ==========================================
    const [{ totalPrinters }] = await db('printers').whereNull('deleted_at').count('* as totalPrinters');
    const [{ totalAPs }] = await db('wifi_networks').whereNull('deleted_at').count('* as totalAPs');
    const [{ backupAlerts }] = await db('data_backups').where(builder => {
      builder.where('status', 'Failed').orWhere('verification_status', 'Failed');
    }).whereNull('deleted_at').count('* as backupAlerts');

    // PPE Metrics for Unified Dashboard
    let ppeStats = { totalAssets: 0, totalAcquisitionCost: 0, totalNetBookValue: 0, activeCount: 0 };
    try {
      const ppeAssets = await db('ppe_assets').whereNull('deleted_at').select('acquisition_cost', 'salvage_value', 'useful_life_years', 'purchase_date', 'status');
      let totalCost = 0;
      let totalNBV = 0;
      const { calcStraightLine } = require('../utils/depreciation');
      for (const pa of ppeAssets) {
        totalCost += Number(pa.acquisition_cost) || 0;
        const d = calcStraightLine({
          acquisitionCost: pa.acquisition_cost,
          salvageValue: pa.salvage_value,
          usefulLifeYears: pa.useful_life_years,
          purchaseDate: pa.purchase_date
        });
        totalNBV += d.netBookValue;
      }
      ppeStats = {
        totalAssets: ppeAssets.length,
        totalAcquisitionCost: Math.round(totalCost * 100) / 100,
        totalNetBookValue: Math.round(totalNBV * 100) / 100,
        activeCount: ppeAssets.filter(p => p.status === 'ACTIVE').length
      };
    } catch (e) {
      // Table may not be migrated yet
    }

    return res.json({
      success: true,
      data: {
        assetCounts,
        ticketCounts,
        lowStockCount,
        expiringWarranties,
        expiringLicenses,
        overduePM,
        totalRepairCost: parseFloat(totalRepairCost) || 0,
        recentActivities,
        recentTickets,
        recentAssignments,
        itOps: {
          totalPrinters: parseInt(totalPrinters) || 0,
          totalAPs: parseInt(totalAPs) || 0,
          backupAlerts: parseInt(backupAlerts) || 0
        },
        ppe: ppeStats,
        charts: {
          assetsByCategory,
          assetsByStatus: assetStats.map(s => ({ name: s.status, value: parseInt(s.count) })),
          ticketsByPriority,
          ticketsByStatus,
          ticketTrends,
          repairTrends
        }
      }
    });

  } catch (err) {
    logger.error(`Get dashboard statistics error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dashboard details.' });
  }
});

module.exports = router;
