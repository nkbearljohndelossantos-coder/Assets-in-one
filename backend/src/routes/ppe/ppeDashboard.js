const express = require('express');
const dayjs = require('dayjs');
const db = require('../../config/db');
const { authenticateToken } = require('../../middleware/auth');
const { calcStraightLine, money } = require('../../utils/depreciation');

const ppeDashboardRouter = express.Router();

// GET PPE DASHBOARD SUMMARY
ppeDashboardRouter.get('/summary', authenticateToken, async (req, res, next) => {
  try {
    const asOf = req.query.asOf ? String(req.query.asOf) : new Date().toISOString().slice(0, 10);

    const assets = await db('ppe_assets')
      .whereNull('deleted_at')
      .select('id', 'acquisition_cost', 'salvage_value', 'useful_life_years', 'purchase_date', 'status', 'category_name');

    let totalAssetValue = 0;
    let totalDepreciation = 0;
    let totalNBV = 0;
    const categoryBreakdown = {};
    const statusCounts = { ACTIVE: 0, UNDER_MAINTENANCE: 0, RETIRED: 0 };

    for (const a of assets) {
      const cost = Number(a.acquisition_cost) || 0;
      totalAssetValue += cost;

      const d = calcStraightLine({
        acquisitionCost: a.acquisition_cost,
        salvageValue: a.salvage_value,
        usefulLifeYears: a.useful_life_years,
        purchaseDate: a.purchase_date,
        asOfDate: asOf,
      });

      totalDepreciation += d.accumulatedDepreciation;
      totalNBV += d.netBookValue;

      // Status
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;

      // Category breakdown
      const cat = a.category_name || 'Uncategorized';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { count: 0, cost: 0, nbv: 0 };
      }
      categoryBreakdown[cat].count += 1;
      categoryBreakdown[cat].cost += cost;
      categoryBreakdown[cat].nbv += d.netBookValue;
    }

    return res.json({
      asOf,
      totalAssetValue: money(totalAssetValue),
      totalDepreciation: money(totalDepreciation),
      totalNetBookValue: money(totalNBV),
      totalAssets: assets.length,
      statusCounts,
      categoryBreakdown,
    });
  } catch (err) {
    return next(err);
  }
});

// GET PPE 12-MONTH DEPRECIATION TRENDS
ppeDashboardRouter.get('/trends', authenticateToken, async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const assets = await db('ppe_assets')
      .whereNull('deleted_at')
      .select('acquisition_cost', 'salvage_value', 'useful_life_years', 'purchase_date');

    const monthly = Array.from({ length: 12 }, (_, idx) => ({
      month: idx + 1,
      name: dayjs(`${year}-${String(idx + 1).padStart(2, '0')}-01`).format('MMM'),
      depreciation: 0,
    }));

    for (const a of assets) {
      const cost = Number(a.acquisition_cost) || 0;
      const salvage = Number(a.salvage_value) || 0;
      const lifeYears = Number(a.useful_life_years) || 0;
      const annual = lifeYears > 0 ? (cost - salvage) / lifeYears : 0;
      const monthlyDep = annual / 12;

      const start = dayjs(a.purchase_date).startOf('month');
      const end = start.add(lifeYears * 12, 'month');

      for (let m = 1; m <= 12; m++) {
        const cur = dayjs(`${year}-${String(m).padStart(2, '0')}-01`).startOf('month');
        const nextMonth = cur.add(1, 'month');
        const overlaps = cur.isBefore(end) && nextMonth.isAfter(start);
        if (overlaps) {
          monthly[m - 1].depreciation += monthlyDep;
        }
      }
    }

    for (const item of monthly) {
      item.depreciation = money(item.depreciation);
    }

    return res.json({ year, monthly });
  } catch (err) {
    return next(err);
  }
});

module.exports = { ppeDashboardRouter };
