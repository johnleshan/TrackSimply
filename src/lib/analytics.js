/**
 * Analytics engine.
 *
 * Every function here is pure: it reads plain arrays and returns plain objects.
 * Nothing in this file touches the network, the database, React or the DOM, so
 * the whole engine can be reasoned about and tested independently of the app.
 *
 * All of it operates on rows the application already reads. No analytics
 * feature in this module writes to the database.
 */

import { parseIsoDate, toIsoDate } from './format.js';
import { daysInRange, isAllTime, bucketStart, enumerateBuckets, autoGranularity } from './dateRange.js';

const VEHICLE_CATEGORIES = ['Fuel', 'Service/Maintenance', 'Licensing/Insurance', 'Revenue', 'Other'];

/**
 * Categories treated as scaling with activity rather than being a fixed
 * overhead. This is an explicit heuristic, not an accounting fact — the schema
 * has no cost-of-goods field, so true contribution margin cannot be derived.
 */
const VARIABLE_EXPENSE_CATEGORIES = ['Stock/Inventory', 'Fuel'];

const UNCATEGORISED = 'Uncategorised';

/* ------------------------------------------------------------------ *
 * Range resolution
 * ------------------------------------------------------------------ */

/** First and last dates actually present in the data. */
export function dataExtent(transactions) {
  let first = null;
  let last = null;
  for (const tx of transactions || []) {
    const date = parseIsoDate(tx.date);
    if (!date) continue;
    const iso = toIsoDate(date);
    if (!first || iso < first) first = iso;
    if (!last || iso > last) last = iso;
  }
  return { first, last };
}

/**
 * Collapses the All Time sentinel to the span the data actually occupies.
 *
 * ALL_TIME is 1970-01-01 to 2099-12-31 — a sentinel that predates the app. Used
 * directly it enumerates roughly 1,560 empty monthly buckets, which makes every
 * average wrong (a net divided by 130 years of nothing) and renders the trend
 * chart as one unreadable spike.
 *
 * Bounded periods are returned untouched: an owner who selects a window with no
 * activity in it should see that window, empty.
 */
export function resolveAnalysisRange(range, transactions) {
  if (!isAllTime(range)) return range;
  const { first, last } = dataExtent(transactions);
  if (!first || !last) return range;
  return { start: first, end: last };
}

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export function normalizeType(type) {
  return String(type || '').trim().toLowerCase() === 'income' ? 'income' : 'expense';
}

export function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function categoryKey(tx) {
  const raw = String(tx.category || '').trim();
  return raw || UNCATEGORISED;
}

export function isInRange(tx, range) {
  const date = parseIsoDate(tx.date);
  if (!date) return false;
  const iso = toIsoDate(date);
  return iso >= range.start && iso <= range.end;
}

export function filterRange(rows, range) {
  return rows.filter((row) => isInRange(row, range));
}

/** The equally-long window immediately before `range`, for period-on-period. */
export function previousRange(range) {
  if (isAllTime(range)) return null;
  const length = daysInRange(range);
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (length - 1) * 86400000);
  return { start: toIsoDate(prevStart), end: toIsoDate(prevEnd) };
}

export function movingAverage(values, window = 3) {
  return values.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = values.slice(from, i + 1);
    return slice.reduce((sum, v) => sum + toNumber(v), 0) / slice.length;
  });
}

/* ------------------------------------------------------------------ *
 * Core period summary
 * ------------------------------------------------------------------ */

export function summarize(transactions, range) {
  const rows = filterRange(transactions || [], range);

  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let biggestExpense = null;
  let biggestIncome = null;

  for (const tx of rows) {
    const amount = toNumber(tx.amount);
    if (normalizeType(tx.type) === 'income') {
      income += amount;
      incomeCount += 1;
      if (!biggestIncome || amount > toNumber(biggestIncome.amount)) biggestIncome = tx;
    } else {
      expense += amount;
      expenseCount += 1;
      if (!biggestExpense || amount > toNumber(biggestExpense.amount)) biggestExpense = tx;
    }
  }

  const net = income - expense;
  return {
    income,
    expense,
    net,
    // A null margin is deliberate. Showing 0% when there was no income at all
    // reads as "broke even", which is a materially different message.
    margin: income > 0 ? (net / income) * 100 : null,
    transactionCount: rows.length,
    incomeCount,
    expenseCount,
    avgIncome: incomeCount ? income / incomeCount : 0,
    avgExpense: expenseCount ? expense / expenseCount : 0,
    biggestExpense,
    biggestIncome,
    profitable: net > 0,
  };
}

export function byCategory(transactions, range, type) {
  const wanted = normalizeType(type);
  const totals = new Map();

  for (const tx of filterRange(transactions || [], range)) {
    if (normalizeType(tx.type) !== wanted) continue;
    const key = categoryKey(tx);
    const current = totals.get(key) || { category: key, amount: 0, count: 0 };
    current.amount += toNumber(tx.amount);
    current.count += 1;
    totals.set(key, current);
  }

  const grand = [...totals.values()].reduce((sum, c) => sum + c.amount, 0);
  return [...totals.values()]
    .map((c) => ({ ...c, pct: grand > 0 ? (c.amount / grand) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Item #1: a readable profit and loss statement for the period. */
export function profitAndLoss(transactions, range) {
  const totals = summarize(transactions, range);
  const income = byCategory(transactions, range, 'income');
  const expense = byCategory(transactions, range, 'expense');
  return {
    ...totals,
    incomeLines: income,
    expenseLines: expense,
    expenseRatio: totals.income > 0 ? (totals.expense / totals.income) * 100 : null,
  };
}

/* ------------------------------------------------------------------ *
 * Time series
 * ------------------------------------------------------------------ */

export function timeSeries(transactions, range, granularity = autoGranularity(range)) {
  // One map, one object per bucket. Building a second array of fresh objects
  // here would silently discard every total accumulated below.
  const slots = new Map(
    enumerateBuckets(range, granularity).map((date) => [
      toIsoDate(date),
      { date: toIsoDate(date), income: 0, expense: 0 },
    ])
  );

  for (const tx of filterRange(transactions || [], range)) {
    const date = parseIsoDate(tx.date);
    if (!date) continue;
    const slot = slots.get(toIsoDate(bucketStart(date, granularity)));
    if (!slot) continue;
    if (normalizeType(tx.type) === 'income') slot.income += toNumber(tx.amount);
    else slot.expense += toNumber(tx.amount);
  }

  let running = 0;
  return [...slots.values()].map((point) => {
    const net = point.income - point.expense;
    running += net;
    return { ...point, net, cumulative: running };
  });
}

/** Item #2: cumulative net position — the curve a business actually runs on. */
export function cashFlow(transactions, range, granularity = autoGranularity(range)) {
  return timeSeries(transactions, range, granularity);
}

export function periodComparison(transactions, range) {
  const previous = previousRange(range);
  if (!previous) return null;

  const currentTotals = summarize(transactions, range);
  const previousTotals = summarize(transactions, previous);

  const delta = (now, before) => {
    if (!before) return { absolute: now, pct: null };
    return { absolute: now - before, pct: ((now - before) / Math.abs(before)) * 100 };
  };

  return {
    previous,
    current: currentTotals,
    prior: previousTotals,
    income: delta(currentTotals.income, previousTotals.income),
    expense: delta(currentTotals.expense, previousTotals.expense),
    net: delta(currentTotals.net, previousTotals.net),
  };
}

/* ------------------------------------------------------------------ *
 * Budgets
 * ------------------------------------------------------------------ */

function daysElapsed(range, now = new Date()) {
  if (isAllTime(range)) return daysInRange(range);
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const capped = today < end ? today : end;
  const elapsed = Math.round((capped - start) / 86400000) + 1;
  return Math.max(1, Math.min(elapsed, daysInRange(range)));
}

/**
 * Item #5: burn rate, projection and a verdict per budget.
 *
 * Spend is derived from transactions matched on category name, because
 * `budgets.actual` is maintained by hand via the "+ Spend" button and drifts
 * from reality. Where no transactions match, the stored figure is used and the
 * row is flagged as manually tracked so the divergence is visible rather than
 * silently believed.
 */
export function budgetAnalytics(budgets, transactions, range, now = new Date()) {
  const rows = budgets || [];
  const expenseByCategory = new Map(
    byCategory(transactions, range, 'expense').map((c) => [c.category.toLowerCase(), c.amount])
  );

  const elapsed = daysElapsed(range, now);
  const total = daysInRange(range);

  const results = rows.map((budget) => {
    const target = toNumber(budget.budget);
    const stored = toNumber(budget.actual);
    const derived = expenseByCategory.get(String(budget.category || '').trim().toLowerCase()) || 0;
    const actual = derived > 0 ? derived : stored;
    const manual = derived === 0 && stored > 0;
    const diverged = derived > 0 && stored > 0 && Math.abs(derived - stored) > 1;

    const used = target > 0 ? (actual / target) * 100 : null;
    const dailyBurn = elapsed > 0 ? actual / elapsed : 0;
    const projected = dailyBurn * total;

    let verdict = 'on-track';
    if (target <= 0) verdict = 'no-target';
    else if (actual >= target) verdict = 'overspent';
    else if (projected > target) verdict = 'projected-overshoot';
    else if (used !== null && used >= 85) verdict = 'watch';

    return {
      id: budget.id,
      category: budget.category,
      target,
      actual,
      stored,
      derived,
      manual,
      diverged,
      used,
      dailyBurn,
      projected,
      remaining: Math.max(0, target - actual),
      verdict,
      headroom: projected - target,
    };
  });

  const totals = results.reduce(
    (acc, r) => ({
      target: acc.target + r.target,
      actual: acc.actual + r.actual,
      projected: acc.projected + r.projected,
    }),
    { target: 0, actual: 0, projected: 0 }
  );

  return {
    rows: results.sort((a, b) => (b.used ?? -1) - (a.used ?? -1)),
    totals: {
      ...totals,
      used: totals.target > 0 ? (totals.actual / totals.target) * 100 : null,
      projectedUsed: totals.target > 0 ? (totals.projected / totals.target) * 100 : null,
    },
    atRisk: results.filter((r) => r.verdict === 'projected-overshoot' || r.verdict === 'overspent'),
    diverged: results.filter((r) => r.diverged),
    elapsedDays: elapsed,
    totalDays: total,
    daysRemaining: Math.max(0, total - elapsed),
  };
}

/* ------------------------------------------------------------------ *
 * Debts
 * ------------------------------------------------------------------ */

const MAX_MONTHS = 600;

/**
 * Item #4, part one: amortisation of a single obligation.
 *
 * Simulated rather than solved in closed form so that underpayment, zero
 * interest and a final partial payment are all handled without special cases.
 * The unpaid case matters most: a minimum payment below the monthly interest
 * balance means the debt never clears, which is worth surfacing loudly.
 */
export function amortize(debt, { maxMonths = MAX_MONTHS } = {}) {
  const principal = toNumber(debt.total);
  const annualRate = toNumber(debt.interest);
  const payment = toNumber(debt.min_payment);
  const monthlyRate = annualRate / 100 / 12;

  const base = { principal, annualRate, payment, monthlyRate };

  if (principal <= 0) return { ...base, status: 'no-balance', months: 0, totalInterest: 0, totalPaid: 0, schedule: [] };
  if (payment <= 0) return { ...base, status: 'no-payment', months: null, totalInterest: null, totalPaid: 0, schedule: [] };

  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  let months = 0;
  const schedule = [];

  while (balance > 0.01 && months < maxMonths) {
    const interest = balance * monthlyRate;
    const principalPart = payment - interest;

    if (principalPart <= 0) {
      return {
        ...base,
        status: 'never-clears',
        months: null,
        totalInterest: null,
        totalPaid,
        shortfall: interest - payment,
        schedule,
      };
    }

    const actualPayment = Math.min(payment, balance + interest);
    balance -= principalPart;
    totalInterest += interest;
    totalPaid += actualPayment;
    months += 1;

    schedule.push({ month: months, payment: actualPayment, interest, principal: principalPart, balance: Math.max(0, balance) });
  }

  return {
    ...base,
    status: balance <= 0.01 ? 'cleared' : 'over-term',
    months,
    totalInterest,
    totalPaid,
    schedule,
  };
}

export function monthsBetween(from, months) {
  const target = new Date(from.getFullYear(), from.getMonth() + months, 1);
  return target.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/**
 * Item #4, part two: portfolio view including debt service coverage — the
 * ratio a lender actually uses to judge whether the business can carry the debt.
 */
export function debtAnalytics(debts, transactions, range) {
  const list = (debts || []).map((debt) => {
    const schedule = amortize(debt);
    return {
      ...debt,
      name: debt.name,
      balance: toNumber(debt.total),
      rate: toNumber(debt.interest),
      minPayment: toNumber(debt.min_payment ?? debt.minPayment),
      schedule,
      monthsToClear: schedule.months,
      payoffDate: schedule.months ? monthsBetween(new Date(), schedule.months) : null,
      monthlyInterest: schedule.monthlyRate * toNumber(debt.total),
    };
  });

  const totalDebt = list.reduce((sum, d) => sum + d.balance, 0);
  const totalMonthlyPayment = list.reduce((sum, d) => sum + d.minPayment, 0);
  const totalMonthlyInterest = list.reduce((sum, d) => sum + d.monthlyInterest, 0);
  const weightedRate = totalDebt > 0 ? list.reduce((sum, d) => sum + d.balance * d.rate, 0) / totalDebt : 0;

  const cleared = list.filter((d) => d.schedule.status === 'cleared');
  const neverClears = list.filter((d) => d.schedule.status === 'never-clears');
  const remainingInterest = cleared.reduce((sum, d) => sum + toNumber(d.schedule.totalInterest), 0);

  const totals = summarize(transactions, range);
  const months = Math.max(0.5, daysInRange(range) / 30.44);
  const avgMonthlyIncome = totals.income / months;
  const avgMonthlyExpense = totals.expense / months;

  const dscr = totalMonthlyPayment > 0 ? avgMonthlyIncome / totalMonthlyPayment : null;

  let coverage = 'no-debt';
  if (dscr !== null) {
    if (dscr < 1) coverage = 'deficit';
    else if (dscr < 1.25) coverage = 'strained';
    else if (dscr < 1.5) coverage = 'adequate';
    else coverage = 'comfortable';
  }

  return {
    rows: list.sort((a, b) => b.balance - a.balance),
    totalDebt,
    totalMonthlyPayment,
    totalMonthlyInterest,
    remainingInterest,
    weightedRate,
    avgMonthlyIncome,
    avgMonthlyExpense,
    dscr,
    coverage,
    neverClears,
    avgMonthlyNet: avgMonthlyIncome - avgMonthlyExpense,
    debtToMonthlyIncome: avgMonthlyIncome > 0 ? (totalMonthlyPayment / avgMonthlyIncome) * 100 : null,
    firstClear: cleared.length
      ? cleared.reduce((min, d) => (d.schedule.months < min.schedule.months ? d : min))
      : null,
    lastClear: cleared.length
      ? cleared.reduce((max, d) => (d.schedule.months > max.schedule.months ? d : max))
      : null,
  };
}

/* ------------------------------------------------------------------ *
 * Inventory
 * ------------------------------------------------------------------ */

/** Mirrors the substring match Bookkeeping already uses to link a transaction to a product. */
export function matchesItem(description, name) {
  if (!description || !name) return false;
  return String(description).toLowerCase().includes(String(name).toLowerCase());
}

function quantityFromDescription(description) {
  const match = /\(x(\d+)\)/.exec(String(description || ''));
  return match ? Number(match[1]) || 1 : 1;
}

/**
 * Item #7: valuation and movement.
 *
 * Note on turnover: the schema stores selling price, not cost, so a true
 * inventory turnover ratio cannot be computed. What is reported instead is
 * sell-through — units appearing in matched sales — which is honest and
 * answers the question the business is really asking.
 */
export function inventoryAnalytics(items, transactions, range) {
  const list = items || [];
  const rows = list.map((item) => {
    const stock = toNumber(item.stock);
    const reorder = toNumber(item.reorder);
    const price = toNumber(item.price);

    const matches = filterRange(transactions || [], range).filter((tx) => {
      if (normalizeType(tx.type) !== 'income') return false;
      return matchesItem(tx.description, item.name);
    });

    const unitsSold = matches.reduce((sum, tx) => sum + quantityFromDescription(tx.description), 0);
    const revenue = matches.reduce((sum, tx) => sum + toNumber(tx.amount), 0);

    return {
      id: item.id,
      name: item.name,
      stock,
      reorder,
      price,
      value: stock * price,
      lowStock: stock <= reorder,
      shortfall: Math.max(0, reorder - stock),
      unitsSold,
      revenue,
      sellThrough: stock + unitsSold > 0 ? (unitsSold / (stock + unitsSold)) * 100 : null,
      dead: stock > 0 && unitsSold === 0,
    };
  });

  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);
  const lowStock = rows.filter((r) => r.lowStock);

  return {
    rows: rows.sort((a, b) => b.shortfall - a.shortfall || b.value - a.value),
    totals: {
      items: rows.length,
      units: rows.reduce((sum, r) => sum + r.stock, 0),
      value: totalValue,
      lowStockCount: lowStock.length,
      lowStockValue: lowStock.reduce((sum, r) => sum + r.value, 0),
      unitsSold: rows.reduce((sum, r) => sum + r.unitsSold, 0),
      revenue: rows.reduce((sum, r) => sum + r.revenue, 0),
      deadCount: rows.filter((r) => r.dead).length,
      deadValue: rows.filter((r) => r.dead).reduce((sum, r) => sum + r.value, 0),
      avgPrice: rows.length ? totalValue / Math.max(1, rows.reduce((sum, r) => sum + r.stock, 0)) : 0,
    },
    critical: rows.filter((r) => r.lowStock),
    dead: rows.filter((r) => r.dead),
  };
}

/* ------------------------------------------------------------------ *
 * Fleet
 * ------------------------------------------------------------------ */

/**
 * Item #8: per-vehicle economics.
 *
 * `transactions.vehicle_reg` is currently used only to group rows in a table.
 * Grouping by it and netting against the registry turns it into a real unit
 * economics view — for a delivery business this is usually the screen that
 * identifies a vehicle costing more than it contributes.
 */
export function fleetAnalytics(vehicles, transactions) {
  const registry = vehicles || [];
  const vehicleRows = transactions || [];

  const known = new Set();
  const rows = registry.map((vehicle) => {
    known.add(vehicle.reg_no);
    return {
      regNo: vehicle.reg_no,
      description: vehicle.description || '—',
      id: vehicle.id,
      income: 0,
      expense: 0,
      count: 0,
      categories: Object.fromEntries(VEHICLE_CATEGORIES.map((c) => [c, 0])),
    };
  });

  for (const tx of vehicleRows) {
    const reg = tx.vehicle_reg || 'Unassigned';
    if (!known.has(reg)) {
      known.add(reg);
      rows.push({
        regNo: reg,
        description: 'Not in registry',
        id: null,
        income: 0,
        expense: 0,
        count: 0,
        categories: Object.fromEntries(VEHICLE_CATEGORIES.map((c) => [c, 0])),
      });
    }
    const row = rows.find((r) => r.regNo === reg);
    const amount = toNumber(tx.amount);
    if (normalizeType(tx.type) === 'income') row.income += amount;
    else row.expense += amount;
    row.count += 1;
    const category = String(tx.category || 'Other');
    row.categories[category] = (row.categories[category] || 0) + amount;
  }

  const enriched = rows
    .map((row) => {
      // net must be resolved before it is used. Referencing row.net inside the
      // same object literal that defines it yields undefined, and the ratio
      // below silently becomes NaN.
      const net = row.income - row.expense;
      return {
        ...row,
        net,
        costPerEntry: row.count ? row.expense / row.count : 0,
        // Only a vehicle that actually generated revenue can be judged on
        // contribution; an idle one is a cost centre, not a loss-maker.
        returns: row.income > 0 ? (net / row.income) * 100 : null,
      };
    })
    .sort((a, b) => b.expense - a.expense);

  const totalExpense = enriched.reduce((sum, r) => sum + r.expense, 0);
  const totalIncome = enriched.reduce((sum, r) => sum + r.income, 0);

  return {
    rows: enriched,
    totals: {
      vehicles: enriched.length,
      active: enriched.filter((r) => r.count > 0).length,
      expense: totalExpense,
      income: totalIncome,
      net: totalIncome - totalExpense,
      avgCostPerVehicle: enriched.length ? totalExpense / enriched.length : 0,
      fuel: enriched.reduce((sum, r) => sum + (r.categories.Fuel || 0), 0),
      maintenance: enriched.reduce((sum, r) => sum + (r.categories['Service/Maintenance'] || 0), 0),
      licensing: enriched.reduce((sum, r) => sum + (r.categories['Licensing/Insurance'] || 0), 0),
      unassigned: vehicleRows.filter((tx) => !tx.vehicle_reg).length,
    },
    // Vehicles earning nothing against a running cost — the actionable list.
    underperforming: enriched.filter((r) => r.expense > 0 && r.income === 0),
  };
}

/* ------------------------------------------------------------------ *
 * Break-even
 * ------------------------------------------------------------------ */

/**
 * Item #9.
 *
 * Reported on a cash basis, which is sound, plus a fixed-versus-variable split
 * that depends on the VARIABLE_EXPENSE_CATEGORIES heuristic. The cash figure is
 * the reliable one; the split is an estimate and is labelled as such in the UI.
 */
export function breakEven(transactions, range) {
  const totals = summarize(transactions, range);
  const months = Math.max(0.5, daysInRange(range) / 30.44);

  const avgIncome = totals.income / months;
  const avgExpense = totals.expense / months;

  const variableExpense = filterRange(transactions || [], range)
    .filter((tx) => normalizeType(tx.type) === 'expense')
    .filter((tx) => VARIABLE_EXPENSE_CATEGORIES.includes(categoryKey(tx)))
    .reduce((sum, tx) => sum + toNumber(tx.amount), 0) / months;

  const fixedExpense = Math.max(0, avgExpense - variableExpense);
  const contribution = avgIncome - variableExpense;
  const contributionRatio = avgIncome > 0 ? contribution / avgIncome : null;

  return {
    months,
    avgIncome,
    avgExpense,
    avgNet: avgIncome - avgExpense,
    cashBreakEven: avgExpense,
    safetyMargin: avgExpense > 0 ? ((avgIncome - avgExpense) / avgExpense) * 100 : null,
    variableExpense,
    fixedExpense,
    contribution,
    contributionRatio,
    modelledBreakEven: contributionRatio !== null && contributionRatio > 0 ? fixedExpense / contributionRatio : null,
    heuristicCategories: VARIABLE_EXPENSE_CATEGORIES,
  };
}

/* ------------------------------------------------------------------ *
 * Anomaly detection
 * ------------------------------------------------------------------ */

/**
 * Item #6: flags spend that is out of character for its own category.
 *
 * Compares the most recent *complete* month against the median of the complete
 * months before it. Median rather than mean, because one runaway month would
 * inflate the average and mask itself.
 *
 * The in-progress month is deliberately excluded. Comparing a partial month
 * against complete ones makes every early-month reading look artificially calm
 * and every mid-month one look like a fall, which is worse than reporting
 * nothing at all.
 */
export function detectOutliers(transactions, { monthsToScan = 6, threshold = 2, now = new Date() } = {}) {
  const expenseRows = (transactions || []).filter((tx) => normalizeType(tx.type) === 'expense');

  const monthKeyOf = (value) => {
    const date = parseIsoDate(value);
    if (!date) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const byMonth = new Map();
  for (const tx of expenseRows) {
    const key = monthKeyOf(tx.date);
    if (!key) continue;
    byMonth.set(key, (byMonth.get(key) || 0) + toNumber(tx.amount));
  }

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const completeMonths = [...byMonth.keys()].sort().filter((key) => key < currentMonthKey);

  if (completeMonths.length < 3) return [];

  const latest = completeMonths[completeMonths.length - 1];
  const history = completeMonths.slice(-(monthsToScan + 1), -1);
  if (!history.length) return [];

  const spendBy = new Map();
  for (const tx of expenseRows) {
    const key = monthKeyOf(tx.date);
    if (key !== latest) continue;
    const category = categoryKey(tx);
    spendBy.set(category, (spendBy.get(category) || 0) + toNumber(tx.amount));
  }

  const flags = [];
  for (const [category, amount] of spendBy) {
    const prior = [];
    for (const monthKey of history) {
      const total = (transactions || [])
        .filter((tx) => normalizeType(tx.type) === 'expense' && categoryKey(tx) === category && monthKeyOf(tx.date) === monthKey)
        .reduce((sum, tx) => sum + toNumber(tx.amount), 0);
      if (total > 0) prior.push(total);
    }
    if (prior.length < 2) continue;

    const sorted = [...prior].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    if (median <= 0) continue;

    const ratio = amount / median;
    if (ratio >= threshold) {
      flags.push({ category, amount, median, ratio, month: latest, excess: amount - median });
    }
  }

  return flags.sort((a, b) => b.excess - a.excess);
}

/* ------------------------------------------------------------------ *
 * Activity
 * ------------------------------------------------------------------ */

export function activityHeatmap(transactions, range) {
  const buckets = enumerateBuckets(range, 'day');
  const totals = new Map(buckets.map((d) => [toIsoDate(d), { income: 0, expense: 0, count: 0 }]));

  for (const tx of filterRange(transactions || [], range)) {
    const slot = totals.get(toIsoDate(tx.date));
    if (!slot) continue;
    slot.count += 1;
    if (normalizeType(tx.type) === 'income') slot.income += toNumber(tx.amount);
    else slot.expense += toNumber(tx.amount);
  }

  const cells = [...totals.entries()].map(([date, value]) => ({
    date,
    ...value,
    net: value.income - value.expense,
  }));

  const max = Math.max(0, ...cells.map((c) => Math.max(c.income, c.expense)));
  const busiest = cells.reduce((best, c) => (c.count > (best?.count ?? -1) ? c : best), null);

  return { cells, max, busiest };
}

export function topMovers(transactions, range, limit = 5) {
  const current = new Map(byCategory(transactions, range, 'expense').map((c) => [c.category, c.amount]));
  const previousWindow = previousRange(range);
  const prior = previousWindow
    ? new Map(byCategory(transactions, previousWindow, 'expense').map((c) => [c.category, c.amount]))
    : new Map();

  const categories = new Set([...current.keys(), ...prior.keys()]);
  return [...categories]
    .map((category) => {
      const now = current.get(category) || 0;
      const before = prior.get(category) || 0;
      return { category, amount: now, previous: before, change: now - before };
    })
    .filter((m) => m.amount > 0 || m.previous > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, limit);
}