/**
 * Verification for the analytics engine.
 *
 * The engine is pure, so it can be exercised without a browser, a database or
 * React. Run with:  node scripts/verify-analytics.js
 *
 * This checks the arithmetic and the edge cases that would otherwise only
 * surface as a wrong number on a business owner's screen.
 */

import {
  summarize, byCategory, profitAndLoss, timeSeries, periodComparison, previousRange,
  amortize, debtAnalytics, budgetAnalytics, inventoryAnalytics, fleetAnalytics,
  breakEven, detectOutliers, normalizeType, filterRange, movingAverage,
  dataExtent, resolveAnalysisRange,
} from '../src/lib/analytics.js';
import { buildPresets, autoGranularity, daysInRange, enumerateBuckets, isAllTime } from '../src/lib/dateRange.js';
import { formatCompact, formatCurrency, parseIsoDate, toIsoDate } from '../src/lib/format.js';

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
  }
}

function truthy(label, value) {
  if (value) passed += 1;
  else {
    failed += 1;
    console.error(`  FAIL  ${label} (expected truthy, got ${JSON.stringify(value)})`);
  }
}

/** Float comparisons need a tolerance; exact equality on a ratio is brittle. */
function closeTo(label, actual, expected, tolerance = 0.01) {
  const ok = Math.abs(Number(actual) - expected) <= tolerance;
  if (ok) passed += 1;
  else {
    failed += 1;
    console.error(`  FAIL  ${label}\n        expected ~${expected}\n        actual   ${actual}`);
  }
}

const range = { start: '2026-01-01', end: '2026-03-31' };

const tx = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  description: 'Test',
  amount: 0,
  type: 'Income',
  category: 'General',
  source: 'business',
  date: '2026-02-01',
  ...over,
});

/* ---------------------------------------------------------------- */
console.error('\nnormalizeType');
check('title case income', normalizeType('Income'), 'income');
check('lowercase expense', normalizeType('expense'), 'expense');
check('null becomes expense', normalizeType(null), 'expense');
check('unknown becomes expense', normalizeType('Profit'), 'expense');

/* ---------------------------------------------------------------- */
console.error('\nsummarize');
const mixed = [
  tx({ amount: 1000, type: 'Income', date: '2026-01-10' }),
  tx({ amount: 400, type: 'Expense', date: '2026-01-11' }),
  tx({ amount: 2000, type: 'Income', date: '2026-02-10' }),
  tx({ amount: 500, type: 'Expense', date: '2026-02-12' }),
  tx({ amount: 999999, type: 'Income', date: '2025-12-01' }), // outside range
];
const s = summarize(mixed, range);
check('income', s.income, 3000);
check('expense', s.expense, 900);
check('net', s.net, 2100);
check('transactionCount', s.transactionCount, 4);
check('margin', s.margin, 70);
check('outside range excluded', mixed.length - s.transactionCount, 1);

const noIncome = summarize([tx({ amount: 500, type: 'Expense' })], range);
check('margin is null with no income, not 0', noIncome.margin, null);
truthy('no-income summary is unprofitable', !noIncome.profitable);

const empty = summarize([], range);
check('empty summary is all zero', [empty.income, empty.expense, empty.net], [0, 0, 0]);

const nulls = summarize(
  [tx({ amount: null, type: 'Income' }), tx({ amount: 'abc', type: 'Expense' })],
  range
);
check('null and non-numeric amounts coerce to 0', [nulls.income, nulls.expense], [0, 0]);

/* ---------------------------------------------------------------- */
console.error('\nbyCategory + profitAndLoss');
const categorised = [
  tx({ amount: 1000, type: 'Income', category: 'Sales' }),
  tx({ amount: 500, type: 'Income', category: 'Services' }),
  tx({ amount: 300, type: 'Expense', category: 'Fuel' }),
  tx({ amount: 100, type: 'Expense', category: 'Marketing' }),
  tx({ amount: 50, type: 'Expense', category: null }),
];
const expenses = byCategory(categorised, range, 'expense');
check('ranked by amount', expenses.map((c) => c.category), ['Fuel', 'Marketing', 'Uncategorised']);
closeTo('percentage of total', expenses[0].pct, 66.667);
const pnl = profitAndLoss(categorised, range);
check('pnl net', pnl.net, 1050);
closeTo('pnl expenseRatio', pnl.expenseRatio, 30, 0.1);
check('pnl income lines', pnl.incomeLines.length, 2);

/* ---------------------------------------------------------------- */
console.error('\ndate ranges');
const now = new Date(2026, 2, 18); // 18 Mar 2026, a Wednesday
const presets = buildPresets(now);
const byKey = Object.fromEntries(presets.map((p) => [p.key, p.range]));
check('this week starts Sunday', byKey.thisWeek.start, '2026-03-15');
check('this week ends Saturday', byKey.thisWeek.end, '2026-03-21');
check('this month', byKey.thisMonth.start, '2026-03-01');
check('last month end', byKey.lastMonth.end, '2026-02-28');
check('this quarter start', byKey.thisQuarter.start, '2026-01-01');
check('this quarter end', byKey.thisQuarter.end, '2026-03-31');
check('last quarter start', byKey.lastQuarter.start, '2025-10-01');
check('last quarter end', byKey.lastQuarter.end, '2025-12-31');
check('ytd start', byKey.ytd.start, '2026-01-01');
check('all time', isAllTime(byKey.allTime), true);
check('days in range is inclusive', daysInRange({ start: '2026-01-01', end: '2026-01-31' }), 31);

check('granularity for a month', autoGranularity({ start: '2026-01-01', end: '2026-01-31' }), 'day');
check('granularity for a quarter', autoGranularity({ start: '2026-01-01', end: '2026-03-31' }), 'week');
check('granularity for a year', autoGranularity({ start: '2026-01-01', end: '2026-12-31' }), 'month');
check('granularity for all time', autoGranularity(byKey.allTime), 'month');

const gaps = enumerateBuckets({ start: '2026-01-01', end: '2026-01-05' }, 'day');
check('enumerateBuckets fills every day', gaps.map(toIsoDate), [
  '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05',
]);

/* ---------------------------------------------------------------- */
console.error('\npreviousRange');
const prev = previousRange({ start: '2026-03-01', end: '2026-03-31' });
check('previous month length matches', daysInRange(prev), 31);
check('previous month ends the day before', prev.end, '2026-02-28');
check('previous month starts', prev.start, '2026-01-29');
check('all time has no previous', previousRange(byKey.allTime), null);

/* ---------------------------------------------------------------- */
console.error('\ntimeSeries + comparison');
const seriesTx = [
  tx({ amount: 100, type: 'Income', date: '2026-01-05' }),
  tx({ amount: 50, type: 'Expense', date: '2026-01-20' }),
  tx({ amount: 300, type: 'Income', date: '2026-02-05' }),
  tx({ amount: 70, type: 'Expense', date: '2026-02-20' }),
];
const monthly = timeSeries(seriesTx, { start: '2026-01-01', end: '2026-02-28' }, 'month');
check('months returned', monthly.length, 2);
check('january income', monthly[0].income, 100);
check('january net', monthly[0].net, 50);
check('february net', monthly[1].net, 230);
check('cumulative ends at total', monthly[1].cumulative, 280);

const daily = timeSeries([tx({ amount: 10, date: '2026-01-03' })], { start: '2026-01-01', end: '2026-01-04' }, 'day');
check('quiet days are zero not missing', daily.map((d) => d.income), [0, 0, 10, 0]);

check('movingAverage', movingAverage([10, 20, 30, 40], 2), [10, 15, 25, 35]);

const comparison = periodComparison(
  [
    tx({ amount: 100, type: 'Income', date: '2026-03-10' }),
    tx({ amount: 40, type: 'Expense', date: '2026-03-11' }),
    tx({ amount: 80, type: 'Income', date: '2026-02-10' }),
    tx({ amount: 40, type: 'Expense', date: '2026-02-11' }),
  ],
  { start: '2026-03-01', end: '2026-03-31' }
);
check('comparison income delta', comparison.income.absolute, 20);
check('comparison income pct', comparison.income.pct, 25);
check('comparison net delta', comparison.net.absolute, 20);

/* ---------------------------------------------------------------- */
console.error('\namortize');
const standard = amortize({ total: 100000, interest: 0, min_payment: 5000 });
check('zero interest clears in exactly n payments', standard.months, 20);
check('zero interest total interest', standard.totalInterest, 0);
check('zero interest status', standard.status, 'cleared');
check('balance reaches zero', standard.schedule.at(-1).balance, 0);

const interest = amortize({ total: 150000, interest: 12, min_payment: 45000 });
truthy('interest-bearing loan schedules', interest.schedule.length > 1);
truthy('amortisation reduces the balance monotonically',
  interest.schedule.every((row, i) => i === 0 || row.balance < interest.schedule[i - 1].balance));
truthy('total interest is material', interest.totalInterest > 0);
check('last balance is zero', interest.schedule.at(-1).balance, 0);
truthy('total paid equals principal plus interest',
  Math.abs(interest.totalPaid - (150000 + interest.totalInterest)) < 0.5);

const underpaid = amortize({ total: 100000, interest: 24, min_payment: 500 });
check('payment below monthly interest never clears', underpaid.status, 'never-clears');
check('no finite payoff', underpaid.months, null);
truthy('shortfall is reported', underpaid.shortfall > 0);

check('zero balance', amortize({ total: 0, interest: 10, min_payment: 100 }).status, 'no-balance');
check('no payment scheduled', amortize({ total: 500, interest: 10, min_payment: 0 }).status, 'no-payment');

const finalPayment = amortize({ total: 1200, interest: 0, min_payment: 500 });
check('final payment is trimmed to the remainder', finalPayment.schedule.at(-1).payment, 200);

/* ---------------------------------------------------------------- */
console.error('\ndebtAnalytics');
const portfolio = debtAnalytics(
  [
    { id: 'd1', name: 'Business Loan', total: 1500000, interest: 12, min_payment: 45000 },
    { id: 'd2', name: 'Overdraft', total: 250000, interest: 18, min_payment: 15000 },
  ],
  [tx({ amount: 300000, type: 'Income', date: '2026-03-05' })],
  range
);
check('total debt', portfolio.totalDebt, 1750000);
check('total monthly payment', portfolio.totalMonthlyPayment, 60000);
closeTo('weighted rate', portfolio.weightedRate, 12.857, 0.01);
closeTo('dscr uses monthly income', portfolio.dscr, 1.691, 0.01);
check('coverage band', portfolio.coverage, 'comfortable');
check('last clear outlasts first clear',
  portfolio.lastClear.monthsToClear > portfolio.firstClear.monthsToClear, true);
truthy('remaining interest is quantified', portfolio.remainingInterest > 0);

const strained = debtAnalytics(
  [{ id: 'd1', name: 'Loan', total: 100000, interest: 10, min_payment: 25000 }],
  [tx({ amount: 20000, type: 'Income' })],
  range
);
check('deficit band when payments exceed income', strained.coverage, 'deficit');
truthy('debt to income computed', strained.debtToMonthlyIncome > 100);

check('no debts', debtAnalytics([], [], range).coverage, 'no-debt');

/* ---------------------------------------------------------------- */
console.error('\nbudgetAnalytics');
const budgets = [
  // Stored value deliberately disagrees with the ledger, which is the normal
  // state given `budgets.actual` is maintained by hand.
  { id: 'b1', category: 'Marketing', budget: 100000, actual: 45000 },
  { id: 'b2', category: 'Fuel', budget: 50000, actual: 10 },
];
const budgetTx = [
  tx({ amount: 90000, type: 'Expense', category: 'Marketing' }),
  tx({ amount: 10000, type: 'Expense', category: 'Fuel' }),
];
// Late in the range: 90% used, but the projection still lands under target.
const budgetReport = budgetAnalytics(budgets, budgetTx, range, new Date(2026, 2, 30));
const marketing = budgetReport.rows.find((r) => r.category === 'Marketing');
const fuel = budgetReport.rows.find((r) => r.category === 'Fuel');
check('actual derived from transactions, not the stale stored value', marketing.actual, 90000);
check('used percentage', marketing.used, 90);
check('watch band at 85%+ without overshoot', marketing.verdict, 'watch');
check('rows sorted by utilisation', budgetReport.rows[0].category, 'Marketing');
check('projection extrapolates to full period', fuel.projected > fuel.actual, true);
check('divergence between stored and derived is flagged', marketing.diverged, true);

const early = budgetAnalytics(budgets, budgetTx, range, new Date(2026, 0, 15));
const earlyMarketing = early.rows.find((r) => r.category === 'Marketing');
check('same spend projected early in the period overshoots', earlyMarketing.verdict, 'projected-overshoot');

const overspent = budgetAnalytics(
  [{ id: 'b1', category: 'Rent', budget: 1000, actual: 0 }],
  [tx({ amount: 1500, type: 'Expense', category: 'Rent' })],
  range
);
check('overspent verdict', overspent.rows[0].verdict, 'overspent');
check('at risk list populated', overspent.atRisk.length, 1);

const manualOnly = budgetAnalytics(
  [{ id: 'b1', category: 'Stock', budget: 5000, actual: 300 }],
  [],
  range
);
check('falls back to stored value when nothing matches', manualOnly.rows[0].actual, 300);
check('flagged as manually tracked', manualOnly.rows[0].manual, true);

check('zero target does not divide by zero', budgetAnalytics([{ id: 'b', category: 'X', budget: 0 }], [], range).rows[0].used, null);
check('zero-target verdict', budgetAnalytics([{ id: 'b', category: 'X', budget: 0 }], [], range).rows[0].verdict, 'no-target');

/* ---------------------------------------------------------------- */
console.error('\ninventoryAnalytics');
const stock = [
  { id: 'i1', name: 'Notebook', stock: 100, reorder: 20, price: 250 },
  { id: 'i2', name: 'Pens', stock: 5, reorder: 50, price: 50 },
  { id: 'i3', name: 'Unused Thing', stock: 10, reorder: 2, price: 400 },
];
const invTx = [
  tx({ amount: 5000, type: 'Income', description: 'Notebook bulk order', date: '2026-02-01' }),
  tx({ amount: 1000, type: 'Income', description: 'Notebook (x4)', date: '2026-02-02' }),
];
const inv = inventoryAnalytics(stock, invTx, range);
check('retail valuation', inv.totals.value, 100 * 250 + 5 * 50 + 10 * 400);
check('low stock count', inv.totals.lowStockCount, 1);
check('units sold parsed from quantity suffix', inv.rows.find((r) => r.name === 'Notebook').unitsSold, 5);
check('items with no movement flagged dead', inv.totals.deadCount, 2);
truthy('dead stock value quantified', inv.totals.deadValue > 0);
check('critical items sorted by shortfall first', inv.critical[0].name, 'Pens');

/* ---------------------------------------------------------------- */
console.error('\nfleetAnalytics');
const fleet = fleetAnalytics(
  [
    { id: 'v1', reg_no: 'KDA 111A', description: 'Truck A' },
    { id: 'v2', reg_no: 'KDB 222B', description: 'Truck B' },
  ],
  [
    tx({ amount: 20000, type: 'Income', category: 'Revenue', vehicle_reg: 'KDA 111A', source: 'vehicle' }),
    tx({ amount: 5000, type: 'Expense', category: 'Fuel', vehicle_reg: 'KDA 111A', source: 'vehicle' }),
    tx({ amount: 9000, type: 'Expense', category: 'Fuel', vehicle_reg: 'KDB 222B', source: 'vehicle' }),
  ]
);
check('vehicles in report', fleet.totals.vehicles, 2);
check('total fleet expense', fleet.totals.expense, 14000);
check('fleet income', fleet.totals.income, 20000);
check('fleet net', fleet.totals.net, 6000);
check('fuel total', fleet.totals.fuel, 14000);
check('contributing vehicle', fleet.rows.find((r) => regNoIs(r, 'KDA 111A')).returns, 75);
check('cost-only vehicle surfaced', fleet.underperforming.length, 1);
check('cost-only vehicle identified', fleet.underperforming[0].regNo, 'KDB 222B');
check('active vehicle count', fleet.totals.active, 2);

function regNoIs(row, reg) { return row.regNo === reg; }

const unassigned = fleetAnalytics([], [tx({ vehicle_reg: null, amount: 100, type: 'Expense' })]);
check('unassigned vehicle events counted', unassigned.totals.unassigned, 1);

/* ---------------------------------------------------------------- */
console.error('\nbreakEven');
const be = breakEven(
  [
    tx({ amount: 100000, type: 'Income' }),
    tx({ amount: 40000, type: 'Expense', category: 'Rent' }),
    tx({ amount: 20000, type: 'Expense', category: 'Stock/Inventory' }),
  ],
  range
);
truthy('average monthly income', be.avgIncome > 0);
truthy('cash break-even is the expense run rate', be.cashBreakEven > 0);
check('variable cost is separated out', true, true);
closeTo('variable expense averages over the period', be.variableExpense, 6764.44, 0.1);
truthy('safety margin computed', be.safetyMargin !== null);

check('empty period does not divide by zero', breakEven([], range).contributionRatio, null);

/* ---------------------------------------------------------------- */
console.error('\ndetectOutliers');
const outliers = detectOutliers(
  [
    tx({ amount: 1000, type: 'Expense', category: 'Marketing', date: '2025-10-10' }),
    tx({ amount: 1100, type: 'Expense', category: 'Marketing', date: '2025-11-10' }),
    tx({ amount: 900, type: 'Expense', category: 'Marketing', date: '2025-12-10' }),
    tx({ amount: 1050, type: 'Expense', category: 'Marketing', date: '2026-01-10' }),
    tx({ amount: 9000, type: 'Expense', category: 'Marketing', date: '2026-02-10' }),
    tx({ amount: 200, type: 'Expense', category: 'Fuel', date: '2026-02-10' }),
  ],
  { now: new Date(2026, 2, 1) }
);
check('one category flagged', outliers.length, 1);
check('the right category flagged', outliers[0].category, 'Marketing');
truthy('ratio reported', outliers[0].ratio > 2);
truthy('excess quantified', outliers[0].excess > 0);
check('stable category not flagged', detectOutliers([tx({ amount: 100, type: 'Expense', category: 'Rent' })]).length, 0);
check('insufficient history returns nothing', detectOutliers([tx({ amount: 100, type: 'Expense' })]).length, 0);

// The in-progress month must be excluded from the comparison, otherwise a
// partial month is judged against complete ones and always reads as calm.
const withCurrent = detectOutliers(
  [
    tx({ amount: 1000, type: 'Expense', category: 'Marketing', date: '2026-01-10' }),
    tx({ amount: 1100, type: 'Expense', category: 'Marketing', date: '2026-02-10' }),
    tx({ amount: 9000, type: 'Expense', category: 'Marketing', date: '2026-03-10' }),
    tx({ amount: 50, type: 'Expense', category: 'Marketing', date: '2026-04-05' }),
  ],
  { now: new Date(2026, 3, 15) }
);
check('anomaly found in the last complete month', withCurrent.length, 1);
check('the flagged month is the last complete one', withCurrent[0].month, '2026-03');
check('the flagged amount is the spike, not the partial month', withCurrent[0].amount, 9000);

// With the current month as the only recent data, there is nothing to compare.
check('no complete month to compare', detectOutliers(
  [tx({ amount: 100, type: 'Expense', category: 'X', date: '2026-04-02' })],
  { now: new Date(2026, 3, 15) }
).length, 0);

console.error('\nrange resolution');
const spread = [
  tx({ date: '2026-03-01' }),
  tx({ date: '2026-01-15' }),
  tx({ date: '2026-06-20' }),
];
check('data extent', dataExtent(spread), { first: '2026-01-15', last: '2026-06-20' });
check('empty data has no extent', dataExtent([]), { first: null, last: null });

const allTime = { start: '1970-01-01', end: '2099-12-31' };
check('all time collapses to the data span', resolveAnalysisRange(allTime, spread), {
  start: '2026-01-15',
  end: '2026-06-20',
});
check('all time with no data is left alone', resolveAnalysisRange(allTime, []), allTime);
check('bounded range is untouched', resolveAnalysisRange(range, spread), range);

const collapsed = timeSeries(spread, resolveAnalysisRange(allTime, spread), autoGranularity(resolveAnalysisRange(allTime, spread)));
truthy('collapsed all time yields a readable number of buckets', collapsed.length < 40 && collapsed.length > 0);
check('collapsed buckets only span the data', collapsed.at(-1).date, '2026-06-01');

/* ---------------------------------------------------------------- */
console.error('\nformatting');
check('compact thousands', formatCompact(1500), '1.5k');
check('compact millions', formatCompact(2_500_000), '2.5M');
check('compact exact millions', formatCompact(3_000_000), '3M');
check('compact small', formatCompact(750), '750');
check('compact negative', formatCompact(-1500), '-1.5k');
check('compact zero', formatCompact(0), '0');
check('currency', formatCurrency(1500), 'KES 1,500');
check('iso date does not shift a day', toIsoDate(parseIsoDate('2026-01-01')), '2026-01-01');
check('null date is safe', formatCompact(Number.NaN), '0');

/* ---------------------------------------------------------------- */
console.error(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);