import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { buildPresets, describeRange, autoGranularity, isAllTime } from '../../lib/dateRange';
import { formatCurrency, formatCompact, formatPercent, formatDate, parseIsoDate, toIsoDate } from '../../lib/format';
import {
  summarize, profitAndLoss, timeSeries, periodComparison, byCategory,
  budgetAnalytics, debtAnalytics, inventoryAnalytics, fleetAnalytics,
  breakEven, detectOutliers, topMovers, activityHeatmap, resolveAnalysisRange,
  dataExtent,
} from '../../lib/analytics';
import { TrendChart, BarList, Donut, ActivityStrip, Gauge } from '../charts/Charts';
import {
  Panel, Grid, StatTile, Verdict, DataTable, Facts, Note, EmptyState, SectionTitle,
} from '../ui/ReportKit';
import DateRangePicker from '../ui/DateRangePicker';
import { downloadCsv, printableTitle } from '../ui/ReportActions';
import { useAppSettings } from '../../lib/appSettings';

const PALETTE = ['#0891b2', '#22d3ee', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0f766e', '#65a30d', '#b45309'];

const VEHICLE_COLORS = {
  Fuel: '#d97706',
  'Service/Maintenance': '#dc2626',
  'Licensing/Insurance': '#7c3aed',
  Revenue: '#059669',
  Other: '#64748b',
};

const colorAt = (index) => PALETTE[index % PALETTE.length];

/**
 * The period the report should open on.
 *
 * The obvious default — this calendar month — is wrong for a business that
 * records in arrears, or in the early days of a month before anything has been
 * logged. It opens on an empty report and looks broken. So: use the current
 * month when it has activity, otherwise the most recent month that does.
 */
function mostRecentDataRange(transactions) {
  const thisMonth = buildPresets().find((p) => p.key === 'thisMonth')?.range;
  const { last } = dataExtent(transactions);

  if (!last || !thisMonth) return thisMonth;
  if (last >= thisMonth.start) return thisMonth;

  const d = parseIsoDate(last);
  if (!d) return thisMonth;

  return {
    start: toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

/**
 * Plain-language definitions. The point is that a business owner can find out
 * what a figure means without leaving the report, so each one says what it is,
 * how it is worked out, and what to do about it.
 */
const EXPLAIN = {
  income: 'Total of every transaction recorded as Income in the selected period. Uses the date on each transaction, not when it was entered.',
  expenses: 'Total of every transaction recorded as Expense in the selected period.',
  netProfit: 'Income minus expenses for the period. If this is negative, the period cost more than it earned.',
  margin: 'Net profit as a percentage of income. It answers "for every 100 shillings that came in, how much was kept?" A 20% margin means 20 of every 100 was profit.',
  average: 'Net profit for the period divided by the number of buckets shown. With a month selected it is profit per day; with a year, per month.',
  cumulative: 'Running total of profit from the start of the period to each point. Where the line sits above zero, the period is profitable overall up to that date. A line that dips below zero means the period had cost more than it earned by that point.',
  dailyActivity: 'One bar per bucket. Green means that bucket ended in profit, red means it ended at a loss. Taller bars mean larger sums moved.',
  incomeByCategory: 'Income grouped by the category recorded against each transaction. Use this to see which parts of the business actually bring money in.',
  expensesByCategory: 'Expenses grouped by category, ranked largest first. This is usually the fastest way to find where money is going.',
  spendMix: 'The same expenses as the bar chart, shown as proportions so the balance between categories is visible at a glance.',
  movements: 'How much each expense category changed against the equivalent preceding period. A large increase is worth explaining before it becomes a habit.',
  outliers: 'Compares the last complete month against the typical month for that same category. A category is flagged when it is at least twice its usual level. The current month is excluded because a part-finished month always looks small. Median, not average, so one big month cannot hide itself.',
  budgetsAllocated: 'The total of every budget target you have set.',
  budgetsSpent: 'What has actually been spent, taken from your transactions and matched to each budget by category name. This is deliberately not the "actual" figure stored on the budget, which is maintained by hand and drifts away from reality.',
  budgetsProjected: 'Where spending will land by the end of the period if it continues at the current daily rate. This is the number that warns you before you overspend, rather than after.',
  burnRate: 'The average amount spent per elapsed day. Multiply it by the days remaining to see the likely final figure.',
  diverged: 'The budget records one figure and your transactions record another. It usually means spending was logged as a transaction but the budget was not updated, or the other way round.',
  debtTotal: 'Everything outstanding across all obligations, added together.',
  debtPayments: 'The total of the minimum monthly payments. This is what leaves the business each month before any profit.',
  weightedRate: 'The average interest rate across all debts, weighted by how much is owed on each. A large balance at a high rate pulls this figure up, and that is where extra repayments save the most.',
  dscr: 'Debt Service Coverage Ratio: average monthly income divided by total monthly repayments. It is the figure a lender uses to judge whether a business can carry its debt. Below 1.0 means repayments exceed income. Lenders generally want 1.25 or better.',
  monthsToClear: 'How long the debt takes to clear if the minimum payment never changes. This is calculated properly by amortisation, where each month the interest is charged first and only the remainder reduces the balance.',
  totalInterest: 'The total interest paid over the whole life of the debt. Compare it against the original balance: a small loan can cost far more than it first appears.',
  neverClears: 'The minimum payment does not cover the monthly interest, so the balance does not fall. It will never be repaid at this level. Raising the payment, or restructuring the rate, is the only way to clear it.',
  balancetrajectory: 'How the outstanding balance falls month by month. The curve is steep at first and flattens later, because early payments are mostly interest.',
  stockValue: 'Total value of stock held, calculated at selling price. Since the records hold no cost price, this is what the stock should sell for, not what it cost you.',
  lowStock: 'Items at or below their reorder point. The shortfall column shows how far below, so the most urgent item comes first.',
  noMovement: 'Items with stock on hand but no matching sale in the period. This is money sitting on a shelf. Bear in mind that sales are matched to products by name in the transaction description, so a differently worded sale will not be counted.',
  unitsSold: 'Units sold, taken from sales whose description mentions the product name. Matching is by name, so keep descriptions consistent for this to be accurate.',
  fleetCost: 'Everything spent on vehicles in the period, across every vehicle.',
  fleetRevenue: 'Income attributed to a vehicle. Only transactions with a registration number attached count here.',
  fleetReturn: 'Net contribution from a vehicle as a percentage of the revenue it generated. A vehicle with costs but no revenue cannot be given a return figure, because there is no revenue to divide by.',
  underperforming: 'Vehicles that carry running costs but have no revenue attributed to them. Either they are genuinely idle, or their income is being logged without a registration number.',
  cashBreakEven: 'The revenue needed each month just to cover the current level of expenses. This is calculated on a cash basis, so it is the most reliable figure here.',
  safetyMargin: 'How far current income sits above the break-even point, as a percentage. The higher it is, the more a bad month can be absorbed before the business starts losing money.',
  modelledSplit: 'An estimate that splits expenses into those that scale with activity and those that do not. It depends on treating certain categories as variable, so treat it as a guide rather than an accounting result. The cash break-even figure does not rely on this.',
  comparison: 'Each figure is compared against the equivalent period immediately before it, so a month is compared with the previous month and a quarter with the previous quarter.',
};

const deltaLabel = (delta) => {
  if (!delta || !Number.isFinite(delta.pct)) return null;
  const sign = delta.pct > 0 ? '+' : '';
  return `${sign}${delta.pct.toFixed(1)}% vs previous`;
};

export default function Analytics() {
  const { user } = useAuth();
  const { settings } = useAppSettings();

  const [range, setRange] = useState(() => {
    const preset = buildPresets().find((p) => p.key === 'thisMonth');
    return preset ? preset.range : { start: '1970-01-01', end: '2099-12-31' };
  });
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [debts, setDebts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const appliedDefaultRange = useRef(false);

  // Once, after the first load: if the opening period has nothing in it, move to
  // the most recent month that does. Never overrides a period the user picked.
  useEffect(() => {
    if (appliedDefaultRange.current || loading || transactions.length === 0) return;
    appliedDefaultRange.current = true;
    const hasActivity = transactions.some((tx) => tx.date >= range.start && tx.date <= range.end);
    if (!hasActivity) setRange(mostRecentDataRange(transactions));
  }, [loading, transactions, range]);

  const rangeLabel = describeRange(range);

  // All Time is stored as a 1970-2099 sentinel. Everything below works against
  // the span the data really covers, so averages and bucket counts stay honest.
  const effectiveRange = useMemo(
    () => resolveAnalysisRange(range, transactions),
    [range, transactions]
  );

  // Scoped identically to the rest of the app: superadmin sees every tenant,
  // everyone else sees only their own rows.
  const scoped = useCallback(
    (table) => {
      let query = supabase.from(table).select('*');
      if (user.role !== 'superadmin') query = query.eq('user_id', user.id);
      return query;
    },
    [user]
  );

  const fetchAll = useCallback(async () => {
    const [txRes, budgetRes, debtRes, inventoryRes, vehicleRes] = await Promise.all([
      scoped('transactions'),
      scoped('budgets'),
      scoped('debts'),
      scoped('inventory'),
      // Fleet is owner-scoped in VehicleManagement with no superadmin bypass,
      // so it stays owner-scoped here to keep the two views consistent.
      supabase.from('vehicles').select('*').eq('user_id', user.id),
    ]);

    setTransactions(txRes.data || []);
    setBudgets(budgetRes.data || []);
    setDebts(debtRes.data || []);
    setInventory(inventoryRes.data || []);
    setVehicles(vehicleRes.data || []);
    setLoading(false);
  }, [scoped, user.id]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchAll();
  }, [user, fetchAll]);

  // Read-only. This view never writes, so there is nothing to guard against.
  useEffect(() => {
    if (!user) return undefined;
    const channel = supabase
      .channel('analytics-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAll]);

  const report = useMemo(() => {
    // Every computation below uses the resolved range, never the raw sentinel.
    const analysisRange = resolveAnalysisRange(range, transactions);
    const granularity = autoGranularity(analysisRange);
    const series = timeSeries(transactions, analysisRange, granularity);

    const formatBucketLabel = (date) => {
      const d = new Date(`${date}T00:00:00`);
      if (granularity === 'day') return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      if (granularity === 'month') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    return {
      analysisRange,
      granularity,
      series,
      labels: series.map((point) => formatBucketLabel(point.date)),
      pnl: profitAndLoss(transactions, analysisRange),
      totals: summarize(transactions, analysisRange),
      comparison: periodComparison(transactions, analysisRange),
      incomeLines: byCategory(transactions, analysisRange, 'income'),
      expenseLines: byCategory(transactions, analysisRange, 'expense'),
      budgets: budgetAnalytics(budgets, transactions, analysisRange),
      debts: debtAnalytics(debts, transactions, analysisRange),
      inventory: inventoryAnalytics(inventory, transactions, analysisRange),
      fleet: fleetAnalytics(vehicles, transactions),
      breakEven: breakEven(transactions, analysisRange),
      outliers: detectOutliers(transactions),
      movers: topMovers(transactions, analysisRange),
      activity: activityHeatmap(transactions, analysisRange),
      trendIncome: series.map((p) => p.income),
      trendExpense: series.map((p) => p.expense),
      trendCumulative: series.map((p) => p.cumulative),
    };
  }, [transactions, budgets, debts, inventory, vehicles, range]);

  const handleExport = useCallback(() => {
    const rows = [
      { section: 'Summary', item: 'Total Income', amount: report.totals.income, share: '' },
      { section: 'Summary', item: 'Total Expenses', amount: report.totals.expense, share: '' },
      { section: 'Summary', item: 'Net Profit', amount: report.totals.net, share: '' },
      { section: 'Summary', item: 'Net Margin %', amount: report.totals.margin ?? '', share: '' },
    ];
    for (const line of report.incomeLines) {
      rows.push({ section: 'Income', item: line.category, amount: line.amount, share: line.pct.toFixed(2) });
    }
    for (const line of report.expenseLines) {
      rows.push({ section: 'Expense', item: line.category, amount: line.amount, share: line.pct.toFixed(2) });
    }
    for (const row of report.budgets.rows) {
      rows.push({
        section: 'Budget',
        item: row.category,
        amount: row.actual,
        share: row.used === null ? '' : row.used.toFixed(2),
      });
    }

    downloadCsv(
      `tracksimply-report-${range.start}-to-${range.end}.csv`,
      [
        { label: 'Section', value: (r) => r.section },
        { label: 'Item', value: (r) => r.item },
        { label: 'Amount (KES)', value: (r) => r.amount },
        { label: 'Share %', value: (r) => r.share },
      ],
      rows
    );
  }, [report, range]);

  if (loading) {
    return (
      <div className="tool-view">
        <div className="title-section">
          <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>BUSINESS INTELLIGENCE</p>
          <h1>Analytics <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '10px' }}>(Syncing...)</span></h1>
        </div>
      </div>
    );
  }

  const hasActivity = report.totals.transactionCount > 0;
  const netTone = report.totals.net > 0 ? 'good' : report.totals.net < 0 ? 'bad' : '';

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>BUSINESS INTELLIGENCE</p>
        <h1>Analytics</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          Derived from your existing records. Nothing here changes your data.
        </p>
      </div>

      <div className="rk-print-header">{printableTitle('Analytics Report', rangeLabel)}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', paddingTop: '8px' }}>

        {/* ---------------- Period control ---------------- */}
        <Panel
          title="Reporting Period"
          subtitle="Every figure below respects this window. All comparisons are like-for-like."
          actions={
            settings.reportActionsEnabled ? (
              <>
                <button type="button" className="rk-btn rk-btn-primary" onClick={handleExport} disabled={!hasActivity}>
                  ⬇ Export CSV
                </button>
                <button type="button" className="rk-btn" onClick={() => window.print()}>
                  🖨 Print / Save PDF
                </button>
              </>
            ) : null
          }
        >
          <DateRangePicker
            value={effectiveRange}
            onChange={setRange}
            activePresetKey={isAllTime(range) ? 'allTime' : undefined}
          />
        </Panel>

        {!hasActivity ? (
          <EmptyState
            icon="📉"
            title={`No transactions recorded in ${rangeLabel}`}
            hint="Switch to All Time to see your full history, or log a transaction in Bookkeeping to populate this report."
          />
        ) : (
          <>
            {/* ---------------- Headline ---------------- */}
            <SectionTitle
              hint="Totals for the selected period, with the change against the equivalent preceding period."
              info={EXPLAIN.comparison}
              infoTitle="How comparisons work"
            >
              Performance Summary
            </SectionTitle>

            <Grid min={210}>
              <StatTile
                label="Income"
                value={formatCurrency(report.totals.income)}
                sub={`${report.totals.incomeCount} transactions`}
                tone="good"
                trend={report.comparison?.income.pct}
                trendLabel={deltaLabel(report.comparison?.income)}
                info={EXPLAIN.income}
              />
              <StatTile
                label="Expenses"
                value={formatCurrency(report.totals.expense)}
                sub={`${report.totals.expenseCount} transactions`}
                tone="bad"
                trend={report.comparison?.expense.pct}
                trendLabel={deltaLabel(report.comparison?.expense)}
                info={EXPLAIN.expenses}
              />
              <StatTile
                label="Net Profit"
                value={formatCurrency(report.totals.net)}
                sub={report.totals.margin === null ? 'No income recorded' : `${formatPercent(report.totals.margin)} margin`}
                tone={netTone}
                trend={report.comparison?.net.pct}
                trendLabel={deltaLabel(report.comparison?.net)}
                info={`${EXPLAIN.netProfit}\n\nMargin: ${EXPLAIN.margin}`}
              />
              <StatTile
                label={`Average per ${granularityLabel(report.granularity)}`}
                value={formatCurrency(report.totals.net / Math.max(1, seriesLength(report)))}
                sub={`across ${seriesLength(report)} ${report.granularity} buckets`}
                info={EXPLAIN.average}
              />
            </Grid>

            {/* ---------------- Trends ---------------- */}
            <SectionTitle hint={`Bucketed by ${report.granularity}. Hover any point for exact figures.`}>
              Trends
            </SectionTitle>

            <Grid min={300}>
              <Panel
                title="Income vs Expense"
                subtitle="Each bucket shows money in and money out."
                info={EXPLAIN.dailyActivity}
                infoTitle="Reading this chart"
              >
                <TrendChart
                  labels={report.labels}
                  valueFormat={formatCurrency}
                  series={[
                    { key: 'income', label: 'Income', color: '#059669', values: report.trendIncome },
                    { key: 'expense', label: 'Expense', color: '#dc2626', values: report.trendExpense },
                  ]}
                />
              </Panel>
            </Grid>

            <Grid min={300}>
              <Panel title="Cumulative Net Position" subtitle="Cumulative profit or loss to date. A line below zero means the period has cost money." info={EXPLAIN.cumulative} infoTitle="What this line shows">
                <TrendChart
                  labels={report.labels}
                  area
                  valueFormat={formatCurrency}
                  series={[{ key: 'cumulative', label: 'Cumulative net', color: 'var(--accent-teal)', values: report.trendCumulative }]}
                />
              </Panel>

              <Panel title="Daily Activity" subtitle="Green where the period was in profit, red where it was not." info={EXPLAIN.dailyActivity} infoTitle="Reading the bars">
                <ActivityStrip buckets={report.series} formatValue={formatCurrency} />
                {report.activity.busiest && (
                  <Facts items={[
                    { label: 'Busiest period', value: formatDate(report.activity.busiest.date) },
                    { label: 'Entries', value: report.activity.busiest.count },
                    { label: 'Net that day', value: formatCurrency(report.activity.busiest.net) },
                  ]} />
                )}
              </Panel>
            </Grid>

            {/* ---------------- Where the money goes ---------------- */}
            <SectionTitle hint="Ranked by amount, with the share of the period total.">
              Where The Money Goes
            </SectionTitle>

            <Grid min={300}>
              <Panel title="Income by Category" info={EXPLAIN.incomeByCategory} infoTitle="Income categories">
                <BarList
                  items={report.incomeLines.map((line, i) => ({
                    label: line.category,
                    value: line.amount,
                    count: line.count,
                    color: colorAt(i),
                    meta: `${formatPercent(line.pct)} of income · ${line.count} entries`,
                  }))}
                  formatValue={formatCurrency}
                  emptyLabel="No income recorded in this period"
                />
              </Panel>

              <Panel title="Expenses by Category" info={EXPLAIN.expensesByCategory} infoTitle="Expense categories">
                <BarList
                  items={report.expenseLines.map((line, i) => ({
                    label: line.category,
                    value: line.amount,
                    count: line.count,
                    color: colorAt(i),
                    meta: `${formatPercent(line.pct)} of spend · ${line.count} entries`,
                  }))}
                  formatValue={formatCurrency}
                  emptyLabel="No expenses recorded in this period"
                />
              </Panel>
            </Grid>

            <Grid min={300}>
              <Panel title="Spend Mix" info={EXPLAIN.spendMix} infoTitle="Spend mix">
                <Donut
                  segments={report.expenseLines.slice(0, 6).map((line, i) => ({
                    label: line.category,
                    value: line.amount,
                    color: colorAt(i),
                  }))}
                  centerLabel={formatCompact(report.totals.expense)}
                  centerSub="Total spend"
                  formatValue={formatCurrency}
                />
              </Panel>

              <Panel title="Biggest Movements" subtitle="Change in each category against the previous period." info={EXPLAIN.movements} infoTitle="Biggest movements">
                {report.comparison ? (
                  <BarList
                    items={report.movers.map((mover, i) => ({
                      label: mover.category,
                      value: Math.abs(mover.change),
                      color: mover.change > 0 ? 'var(--danger)' : 'var(--success)',
                      meta: `${mover.change > 0 ? '▲ up' : '▼ down'} ${formatCurrency(Math.abs(mover.change))} from ${formatCurrency(mover.previous)}`,
                    }))}
                    formatValue={formatCurrency}
                    emptyLabel="Not enough history to compare"
                  />
                ) : (
                  <Note>Select a period other than All Time to compare against the preceding period.</Note>
                )}
              </Panel>
            </Grid>

            {report.outliers.length > 0 && (
              <Panel title="Unusual Spending" subtitle="Categories where the latest complete month is far above their own recent norm." info={EXPLAIN.outliers} infoTitle="How this is detected">
                <DataTable
                  keyField="category"
                  rows={report.outliers}
                  columns={[
                    { key: 'category', label: 'Category', render: (r) => r.category },
                    { key: 'amount', label: 'Last complete month', align: 'right', render: (r) => formatCurrency(r.amount) },
                    { key: 'median', label: 'Typical month', align: 'right', render: (r) => formatCurrency(r.median) },
                    {
                      key: 'excess',
                      label: 'Excess',
                      align: 'right',
                      render: (r) => (
                        <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                          +{formatCurrency(r.excess)} ({r.ratio.toFixed(1)}×)
                        </span>
                      ),
                    },
                  ]}
                />
              </Panel>
            )}

            {/* ---------------- Budget health ---------------- */}
            {report.budgets.rows.length > 0 && (
              <>
                <SectionTitle hint="Spending is derived from your transactions. Where a budget's manually maintained figure disagrees, it is flagged.">
                  Budget Health
                </SectionTitle>

                <Grid min={210}>
                  <StatTile label="Allocated" value={formatCurrency(report.budgets.totals.target)} info={EXPLAIN.budgetsAllocated} />
                  <StatTile
                    label="Spent"
                    value={formatCurrency(report.budgets.totals.actual)}
                    sub={`${formatPercent(report.budgets.totals.used)} of allocation`}
                    tone={report.budgets.totals.used >= 100 ? 'bad' : report.budgets.totals.used >= 85 ? 'warn' : 'good'}
                    info={EXPLAIN.budgetsSpent}
                  />
                  <StatTile
                    label="Projected at period end"
                    value={formatCurrency(report.budgets.totals.projected)}
                    sub={formatPercent(report.budgets.totals.projectedUsed)}
                    tone={report.budgets.totals.projectedUsed > 100 ? 'bad' : 'good'}
                    info={EXPLAIN.budgetsProjected}
                  />
                  <StatTile
                    label="Days remaining"
                    value={report.budgets.daysRemaining}
                    sub={`${report.budgets.elapsedDays} of ${report.budgets.totalDays} elapsed`}
                  />
                </Grid>

                {report.budgets.atRisk.length > 0 && (
                  <Note tone="warn">
                    {report.budgets.atRisk.map((r) => r.category).join(', ')} projected to exceed allocation at the current burn rate.
                  </Note>
                )}

                <Panel title="Budget Lines" subtitle="Burn rate is the average spent per elapsed day." info={`${EXPLAIN.burnRate}\n\n${EXPLAIN.diverged}`} infoTitle="Burn rate and divergence">
                  <DataTable
                    rows={report.budgets.rows}
                    columns={[
                      { key: 'category', label: 'Category', render: (r) => (
                        <>
                          <strong>{r.category}</strong>
                          {r.manual && <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>manually tracked</div>}
                          {r.diverged && <div style={{ fontSize: '0.7rem', color: 'var(--warning)' }}>ledger shows {formatCurrency(r.derived)}</div>}
                        </>
                      ) },
                      { key: 'target', label: 'Target', align: 'right', render: (r) => formatCurrency(r.target) },
                      { key: 'actual', label: 'Spent', align: 'right', render: (r) => formatCurrency(r.actual) },
                      { key: 'used', label: 'Utilisation', render: (r) => (
                        <div style={{ minWidth: '120px' }}>
                          <Gauge value={r.used ?? 0} max={100} label={`${r.category} utilisation`} />
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                            {r.used === null ? '—' : formatPercent(r.used)}
                          </div>
                        </div>
                      ) },
                      { key: 'projected', label: 'Projected', align: 'right', render: (r) => (
                        <span style={{ color: r.projected > r.target ? 'var(--danger)' : 'var(--text-main)' }}>
                          {formatCurrency(r.projected)}
                        </span>
                      ) },
                      { key: 'verdict', label: 'Status', render: (r) => <Verdict value={r.verdict} /> },
                    ]}
                  />
                </Panel>
              </>
            )}

            {/* ---------------- Debt ---------------- */}
            {report.debts.rows.length > 0 && (
              <>
                <SectionTitle hint="Payoff projections assume each minimum payment continues unchanged. Debt service coverage is the ratio lenders use to judge affordability.">
                  Debt Burden
                </SectionTitle>

                <Grid min={210}>
                  <StatTile label="Total Outstanding" value={formatCurrency(report.debts.totalDebt)} sub={`${report.debts.rows.length} obligations`} info={EXPLAIN.debtTotal} />
                  <StatTile
                    label="Monthly Payments"
                    value={formatCurrency(report.debts.totalMonthlyPayment)}
                    sub={`${formatCurrency(report.debts.totalMonthlyInterest)} is interest`}
                    info={EXPLAIN.debtPayments}
                  />
                  <StatTile label="Weighted Interest Rate" value={formatPercent(report.debts.weightedRate, 2)} info={EXPLAIN.weightedRate} />
                  <StatTile
                    label="Debt Service Coverage"
                    value={report.debts.dscr === null ? '—' : `${report.debts.dscr.toFixed(2)}×`}
                    sub={coverageHint(report.debts.coverage)}
                    tone={report.debts.coverage === 'deficit' ? 'bad' : report.debts.coverage === 'strained' ? 'warn' : 'good'}
                    info={EXPLAIN.dscr}
                    infoTitle="Debt Service Coverage Ratio"
                  />
                </Grid>

                {report.debts.neverClears.length > 0 && (
                  <Note tone="bad">
                    {report.debts.neverClears.map((d) => d.name).join(', ')}: the minimum payment does not cover the monthly interest, so the balance never reduces. Raising the payment, or restructuring the rate, is the only route to clearing it.
                  </Note>
                )}

                <Panel title="Payoff Schedule" info={`${EXPLAIN.monthsToClear}\n\n${EXPLAIN.totalInterest}\n\n${EXPLAIN.neverClears}`} infoTitle="How these are worked out">
                  <DataTable
                    rows={report.debts.rows}
                    columns={[
                      { key: 'name', label: 'Obligation', render: (d) => (
                        <>
                          <strong>{d.name}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            {formatCurrency(d.balance)} at {formatPercent(d.rate, 1)}
                          </div>
                        </>
                      ) },
                      { key: 'payment', label: 'Min. Payment', align: 'right', render: (d) => formatCurrency(d.minPayment) },
                      {
                        key: 'interest',
                        label: 'Total Interest',
                        align: 'right',
                        render: (d) => (d.schedule.totalInterest === null ? '—' : formatCurrency(d.schedule.totalInterest)),
                      },
                      { key: 'months', label: 'Months to Clear', align: 'right', render: (d) => (d.monthsToClear ?? '—') },
                      { key: 'payoff', label: 'Clears By', render: (d) => d.payoffDate || '—' },
                      { key: 'status', label: 'Status', render: (d) => <Verdict value={d.schedule.status} /> },
                    ]}
                  />
                </Panel>

                {report.debts.rows.some((d) => d.schedule.schedule.length > 1) && (
                  <Panel title="Balance Trajectory" subtitle="Remaining principal month by month. The curve flattens as the balance amortises." info={EXPLAIN.balancetrajectory} infoTitle="Why the curve flattens">
                    <TrendChart
                      height={220}
                      valueFormat={formatCurrency}
                      labels={(() => {
                        const longest = report.debts.rows.reduce(
                          (best, d) => (d.schedule.schedule.length > (best?.schedule.schedule.length ?? 0) ? d : best),
                          null
                        );
                        return (longest?.schedule.schedule ?? []).map((row) => `M${row.month}`);
                      })()}
                      series={report.debts.rows
                        .filter((d) => d.schedule.schedule.length > 1)
                        .slice(0, 4)
                        .map((d, i) => ({
                          key: d.id ?? d.name,
                          label: d.name,
                          color: colorAt(i),
                          values: d.schedule.schedule.map((row) => row.balance),
                        }))}
                    />
                  </Panel>
                )}
              </>
            )}

            {/* ---------------- Inventory ---------------- */}
            {report.inventory.rows.length > 0 && (
              <>
                <SectionTitle hint="Valued at selling price — the schema stores no cost of goods, so true margin and turnover cannot be derived.">
                  Inventory Position
                </SectionTitle>

                <Grid min={210}>
                  <StatTile label="Stock Value" value={formatCurrency(report.inventory.totals.value)} sub={`${report.inventory.totals.units} units across ${report.inventory.totals.items} items`} info={EXPLAIN.stockValue} />
                  <StatTile
                    label="Low Stock Items"
                    value={report.inventory.totals.lowStockCount}
                    sub={formatCurrency(report.inventory.totals.lowStockValue) + ' tied up'}
                    tone={report.inventory.totals.lowStockCount > 0 ? 'warn' : 'good'}
                    info={EXPLAIN.lowStock}
                  />
                  <StatTile label="Units Sold" value={report.inventory.totals.unitsSold} sub={formatCurrency(report.inventory.totals.revenue) + ' matched revenue'} info={EXPLAIN.unitsSold} />
                  <StatTile
                    label="No Movement"
                    value={report.inventory.totals.deadCount}
                    sub={formatCurrency(report.inventory.totals.deadValue) + ' unsold in period'}
                    tone={report.inventory.totals.deadValue > 0 ? 'warn' : 'good'}
                    info={EXPLAIN.noMovement}
                  />
                </Grid>

                {report.inventory.critical.length > 0 && (
                  <Panel title="Reorder Urgency" subtitle="Ranked by how far below the reorder point each item has fallen." info={EXPLAIN.lowStock} infoTitle="Reorder urgency">
                    <DataTable
                      rows={report.inventory.critical}
                      columns={[
                        { key: 'name', label: 'Product', render: (r) => <strong>{r.name}</strong> },
                        { key: 'stock', label: 'In Stock', align: 'right', render: (r) => r.stock },
                        { key: 'reorder', label: 'Reorder At', align: 'right', render: (r) => r.reorder },
                        { key: 'shortfall', label: 'Shortfall', align: 'right', render: (r) => (
                          <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{r.shortfall}</span>
                        ) },
                        { key: 'value', label: 'Value', align: 'right', render: (r) => formatCurrency(r.value) },
                      ]}
                    />
                  </Panel>
                )}

                <Panel title="Stock Detail" info={`${EXPLAIN.unitsSold}\n\n${EXPLAIN.noMovement}`} infoTitle="How sales are matched">
                  <DataTable
                    rows={report.inventory.rows}
                    columns={[
                      { key: 'name', label: 'Product', render: (r) => <strong>{r.name}</strong> },
                      { key: 'stock', label: 'In Stock', align: 'right', render: (r) => r.stock },
                      { key: 'price', label: 'Price', align: 'right', render: (r) => formatCurrency(r.price) },
                      { key: 'value', label: 'Stock Value', align: 'right', render: (r) => formatCurrency(r.value) },
                      { key: 'sold', label: 'Units Sold', align: 'right', render: (r) => r.unitsSold },
                      {
                        key: 'status',
                        label: 'Status',
                        render: (r) => (r.lowStock ? <Verdict value="overspent" /> : r.dead ? <Verdict value="strained" /> : <Verdict value="on-track" />),
                      },
                    ]}
                  />
                </Panel>
              </>
            )}

            {/* ---------------- Fleet ---------------- */}
            {report.fleet.rows.length > 0 && (
              <>
                <SectionTitle hint="Grouped by vehicle registration from your transaction history, matched against the fleet registry.">
                  Fleet Economics
                </SectionTitle>

                <Grid min={210}>
                  <StatTile label="Fleet Running Cost" value={formatCurrency(report.fleet.totals.expense)} sub={`${report.fleet.totals.active} of ${report.fleet.totals.vehicles} active`} tone="bad" info={EXPLAIN.fleetCost} />
                  <StatTile label="Fleet Revenue" value={formatCurrency(report.fleet.totals.income)} tone="good" info={EXPLAIN.fleetRevenue} />
                  <StatTile label="Fleet Net" value={formatCurrency(report.fleet.totals.net)} tone={report.fleet.totals.net >= 0 ? 'good' : 'bad'} info={EXPLAIN.fleetReturn} />
                  <StatTile label="Fuel" value={formatCurrency(report.fleet.totals.fuel)} sub={`${formatCurrency(report.fleet.totals.maintenance)} maintenance`} />
                </Grid>

                {report.fleet.underperforming.length > 0 && (
                  <Note tone="warn">
                    {report.fleet.underperforming.map((v) => v.regNo).join(', ')} carry running costs but have no revenue attributed to them. Either they are idle, or their income is being logged without a vehicle registration.
                  </Note>
                )}

                <Panel title="Per Vehicle" info={`${EXPLAIN.fleetReturn}\n\n${EXPLAIN.underperforming}`} infoTitle="Reading the return column">
                  <DataTable
                    rows={report.fleet.rows}
                    columns={[
                      { key: 'regNo', label: 'Registration', render: (r) => (
                        <>
                          <strong>{r.regNo}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{r.description}</div>
                        </>
                      ) },
                      { key: 'fuel', label: 'Fuel', align: 'right', render: (r) => formatCurrency(r.categories.Fuel || 0) },
                      { key: 'service', label: 'Service', align: 'right', render: (r) => formatCurrency(r.categories['Service/Maintenance'] || 0) },
                      { key: 'income', label: 'Revenue', align: 'right', render: (r) => formatCurrency(r.income) },
                      { key: 'expense', label: 'Total Cost', align: 'right', render: (r) => formatCurrency(r.expense) },
                      { key: 'net', label: 'Net', align: 'right', render: (r) => (
                        <span style={{ color: r.net >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                          {formatCurrency(r.net)}
                        </span>
                      ) },
                      { key: 'returns', label: 'Return', align: 'right', render: (r) => (r.returns === null ? '—' : formatPercent(r.returns, 0)) },
                    ]}
                  />
                </Panel>

                <Panel title="Cost Composition">
                  <BarList
                    items={[
                      { label: 'Fuel', value: report.fleet.totals.fuel, color: VEHICLE_COLORS.Fuel },
                      { label: 'Service / Maintenance', value: report.fleet.totals.maintenance, color: VEHICLE_COLORS['Service/Maintenance'] },
                      { label: 'Licensing / Insurance', value: report.fleet.totals.licensing, color: VEHICLE_COLORS['Licensing/Insurance'] },
                    ].filter((item) => item.value > 0)}
                    formatValue={formatCurrency}
                    emptyLabel="No fleet costs recorded"
                  />
                </Panel>
              </>
            )}

            {/* ---------------- Break-even ---------------- */}
            <SectionTitle hint="Computed from your recorded income and expenses. This is a cash-basis view.">
              Break-Even
            </SectionTitle>

            <Grid min={280}>
              <Panel title="Cash Basis" info={`${EXPLAIN.cashBreakEven}\n\n${EXPLAIN.safetyMargin}`} infoTitle="Cash break-even">
                <Facts items={[
                  { label: 'Average monthly income', value: formatCurrency(report.breakEven.avgIncome) },
                  { label: 'Average monthly expenses', value: formatCurrency(report.breakEven.avgExpense) },
                  { label: 'Average monthly net', value: formatCurrency(report.breakEven.avgNet) },
                  { label: 'Revenue needed to break even', value: formatCurrency(report.breakEven.cashBreakEven) },
                  { label: 'Safety margin', value: report.breakEven.safetyMargin === null ? '—' : formatPercent(report.breakEven.safetyMargin) },
                ]} />
              </Panel>

              <Panel title="Modelled Split" subtitle="Estimated by treating certain categories as variable costs." info={EXPLAIN.modelledSplit} infoTitle="About this estimate">
                <Facts items={[
                  { label: 'Fixed costs', value: formatCurrency(report.breakEven.fixedExpense) },
                  { label: 'Variable costs', value: formatCurrency(report.breakEven.variableExpense) },
                  { label: 'Contribution ratio', value: report.breakEven.contributionRatio === null ? '—' : formatPercent(report.breakEven.contributionRatio, 0) },
                  { label: 'Modelled break-even', value: report.breakEven.modelledBreakEven === null ? '—' : formatCurrency(report.breakEven.modelledBreakEven) },
                ]} />
                <Note tone="warn">
                  This split assumes {report.breakEven.heuristicCategories.join(' and ')} scale with activity and everything else is fixed. Without a cost-of-goods figure it is an estimate, not an accounting result.
                </Note>
              </Panel>
            </Grid>

            {/* ---------------- Profit & loss ---------------- */}
            <SectionTitle hint="A readable statement for the selected period.">
              Profit &amp; Loss
            </SectionTitle>

            <Panel info={EXPLAIN.comparison} infoTitle="How this is built">
              <DataTable
                rows={[
                  // Keyed by group as well as label: a category can appear on
                  // both sides of the statement, and identical keys would make
                  // React duplicate or drop rows.
                  ...report.incomeLines.map((l) => ({ key: `income-${l.category}`, group: 'Income', label: l.category, amount: l.amount, pct: l.pct })),
                  ...report.expenseLines.map((l) => ({ key: `expense-${l.category}`, group: 'Expense', label: l.category, amount: l.amount, pct: l.pct })),
                ]}
                keyField="key"
                columns={[
                  { key: 'group', label: 'Type', render: (r) => (
                    <span style={{ color: r.group === 'Income' ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: '0.78rem' }}>
                      {r.group.toUpperCase()}
                    </span>
                  ) },
                  { key: 'label', label: 'Category', render: (r) => r.label },
                  { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount) },
                  { key: 'pct', label: 'Share', align: 'right', render: (r) => formatPercent(r.pct) },
                ]}
              />
              <Facts items={[
                { label: 'Total income', value: formatCurrency(report.totals.income) },
                { label: 'Total expenses', value: formatCurrency(report.totals.expense) },
                { label: 'Net profit', value: formatCurrency(report.totals.net) },
                { label: 'Net margin', value: report.totals.margin === null ? '—' : formatPercent(report.totals.margin) },
              ]} />
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

function seriesLength(report) {
  return Math.max(1, report.series.length);
}

/** The KPI above is per-bucket, so it must be labelled with the bucket size. */
function granularityLabel(granularity) {
  return { day: 'Day', week: 'Week', month: 'Month', quarter: 'Quarter' }[granularity] || 'Period';
}

function coverageHint(coverage) {
  return {
    comfortable: 'income covers repayments 1.5× or better',
    adequate: 'income covers repayments',
    strained: 'repayments are a heavy share of income',
    deficit: 'repayments exceed average income',
    'no-debt': 'no obligations recorded',
  }[coverage] || '';
}