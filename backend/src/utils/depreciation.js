const dayjs = require('dayjs');

/**
 * Standard monetary rounding helper (2 decimal places)
 */
function money(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate Straight-Line Depreciation with:
 * - Configurable exact days-in-service proration or monthly proration
 * - Guaranteed residual/salvage value floor (NBV never falls below salvage value)
 * - Safe handling of negative costs, zero lifespans, and future acquisition dates
 *
 * @param {Object} params
 * @param {number|string} params.acquisitionCost - Historical acquisition cost
 * @param {number|string} params.salvageValue - Estimated residual / salvage value
 * @param {number|string} params.usefulLifeYears - Useful economic life in years
 * @param {string|Date} params.purchaseDate - Acquisition / in-service date
 * @param {string|Date} [params.asOfDate] - Target calculation date (default: today)
 * @param {boolean} [params.useDaysProration=false] - Whether to use exact days proration
 * @returns {Object} Depreciation metrics breakdown
 */
function calcStraightLine({
  acquisitionCost,
  salvageValue = 0,
  usefulLifeYears,
  purchaseDate,
  asOfDate,
  useDaysProration = false,
}) {
  const cost = money(acquisitionCost);
  const salvage = money(salvageValue);
  const lifeYears = Math.max(Number(usefulLifeYears) || 0, 0);

  // Depreciable base = Cost - Salvage (never negative)
  const depreciableBase = Math.max(0, cost - salvage);

  const annualDep = lifeYears > 0 ? depreciableBase / lifeYears : 0;
  const monthlyDep = annualDep / 12;
  const dailyDep = lifeYears > 0 ? depreciableBase / (lifeYears * 365.25) : 0;

  const start = dayjs(purchaseDate).startOf('day');
  const asOf = dayjs(asOfDate || new Date()).startOf('day');

  // If dates are invalid or asOf is before purchase date
  if (!start.isValid() || !asOf.isValid() || asOf.isBefore(start) || lifeYears <= 0 || depreciableBase <= 0) {
    return {
      acquisitionCost: money(cost),
      salvageValue: money(salvage),
      depreciableBase: money(depreciableBase),
      usefulLifeYears: lifeYears,
      annualDepreciation: money(annualDep),
      monthlyDepreciation: money(monthlyDep),
      dailyDepreciation: money(dailyDep),
      accumulatedDepreciation: 0,
      netBookValue: money(cost),
      monthsDepreciated: 0,
      daysInService: 0,
      isFullyDepreciated: false,
    };
  }

  const totalDays = Math.round(lifeYears * 365.25);
  const totalMonths = lifeYears * 12;

  let accumulated = 0;
  let monthsDepreciated = 0;
  let daysInService = Math.max(0, asOf.diff(start, 'day'));

  if (useDaysProration) {
    const activeDays = Math.min(daysInService, totalDays);
    accumulated = Math.min(depreciableBase, activeDays * dailyDep);
    monthsDepreciated = money(activeDays / 30.4375);
  } else {
    // Monthly proration (standard accounting convention)
    const monthsSince = asOf.diff(start, 'month');
    monthsDepreciated = Math.min(Math.max(monthsSince, 0), totalMonths);
    accumulated = Math.min(depreciableBase, monthsDepreciated * monthlyDep);
  }

  // Round accumulated depreciation
  const roundedAccum = money(accumulated);

  // Net Book Value cannot fall below salvage value
  const netBookValue = Math.max(salvage, money(cost - roundedAccum));
  const isFullyDepreciated = roundedAccum >= depreciableBase;

  return {
    acquisitionCost: money(cost),
    salvageValue: money(salvage),
    depreciableBase: money(depreciableBase),
    usefulLifeYears: lifeYears,
    annualDepreciation: money(annualDep),
    monthlyDepreciation: money(monthlyDep),
    dailyDepreciation: money(dailyDep),
    accumulatedDepreciation: roundedAccum,
    netBookValue: money(netBookValue),
    monthsDepreciated,
    daysInService,
    isFullyDepreciated,
  };
}

module.exports = {
  money,
  calcStraightLine,
};
