import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { buildPresets, describeRange, autoGranularity } from '../../lib/dateRange';
import { formatCurrency, formatCompact, formatPercent, formatDate } from '../../lib/format';
import {
  summarize, profitAndLoss, timeSeries, periodComparison, byCategory,
  budgetAnalytics, debtAnalytics, inventoryAnalytics, fleetAnalytics,
  breakEven, detectOutliers, topMovers, activityHeatmap,
} from '../../lib/analytics';
import { TrendChart, BarList, Donut, ActivityStrip, Gauge } from '../charts/Charts';
import {
  Panel, Grid, StatTile, Verdict, DataTable, Facts, Note, EmptyState, SectionTitle,
} from '../ui/ReportKit';
import DateRangePicker from '../ui/DateRangePicker';
import { downloadCsv, printableTitle } from '../ui/ReportActions';

const PALETTE = ['#0891b2', '#22d3ee', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0f766e', '#65a30d', '#b45309'];

const VEHICLE_COLORS = {
  Fuel: '#d97706',
  'Service/Maintenance': '#dc2626',
  'Licensing/Insurance': '#7c3aed',
  Revenue: '#059669',
  Other: '#64748b',
};

const colorAt = (index) => PALETTE[index % PALETTE.length];

const deltaLabel = (delta) => {
  if (!delta || !Number.isFinite(delta.pct)) return null;
  const sign = delta.pct > 0 ? '+' : '';
  return `${sign}${delta.pct.toFixed(1)}% vs previous`;
};

export default function Analytics() {
  const { user } = useAuth();

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

  const rangeLabel = describeRange(range);

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
    const granularity = autoGranularity(range);
    const series = timeSeries(transactions, range, granularity);

    const formatBucketLabel = (date) => {
      const d = new Date(`${date}T00:00:00`);
      if (granularity === 'day') return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      if (granularity === 'month') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    return {
      granularity,
      series,
      labels: series.map((point) => formatBucketLabel(point.date)),
      pnl: profitAndLoss(transactions, range),
      totals: summarize(transactions, range),
      comparison: periodComparison(transactions, range),
      incomeLines: byCategory(transactions, range, 'income'),
      expenseLines: byCategory(transactions, range, 'expense'),
      budgets: budgetAnalytics(budgets, transactions, range),
      debts: debtAnalytics(debts, transactions, range),
      inventory: inventoryAnalytics(inventory, transactions, range),
      fleet: fleetAnalytics(vehicles, transactions),
      breakEven: breakEven(transactions, range),
      outliers: detectOutliers(transactions),
      movers: topMovers(transactions, range),
      activity: activityHeatmap(transactions, range),
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
            <>
              <button type="button" className="rk-btn rk-btn-primary" onClick={handleExport} disabled={!hasActivity}>
                ⬇ Export CSV
              </button>
              <button type="button" className="rk-btn" onClick={() => window.print()}>
                🖨 Print / Save PDF
              </button>
            </>
          }
        >
          <DateRangePicker value={range} onChange={setRange} />
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
            <SectionTitle hint="Totals for the selected period, with the change against the equivalent preceding period.">
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
              />
              <StatTile
                label="Expenses"
                value={formatCurrency(report.totals.expense)}
                sub={`${report.totals.expenseCount} transactions`}
                tone="bad"
                trend={report.comparison?.expense.pct}
                trendLabel={deltaLabel(report.comparison?.expense)}
              />
              <StatTile
                label="Net Profit"
                value={formatCurrency(report.totals.net)}
                sub={report.totals.margin === null ? 'No income recorded' : `${formatPercent(report.totals.margin)} margin`}
                tone={netTone}
                trend={report.comparison?.net.pct}
                trendLabel={deltaLabel(report.comparison?.net)}
              />
              <StatTile
                label={`Average per ${granularityLabel(report.granularity)}`}
                value={formatCurrency(report.totals.net / Math.max(1, seriesLength(report)))}
                sub={`across ${seriesLength(report)} ${report.granularity} buckets`}
              />
            </Grid>

            {/* ---------------- Trends ---------------- */}
            <SectionTitle hint={`Bucketed by ${report.granularity}. Hover any point for exact figures.`}>
              Trends
            </SectionTitle>

            <Panel title="Income vs Expense" subtitle="Each bucket shows money in and money out.">
              <TrendChart
                labels={report.labels}
                series={[
                  { key: 'income', label: 'Income', color: '#059669', values: report.trendIncome },
                  { key: 'expense', label: 'Expense', color: '#dc2626', values: report.trendExpense },
                ]}
              />
            </Panel>

            <Grid min={300}>
              <Panel title="Cumulative Net Position" subtitle="Cumulative profit or loss to date. A line below zero means the period has cost money.">
                <TrendChart
                  labels={report.labels}
                  area
                  series={[{ key: 'cumulative', label: 'Cumulative net', color: 'var(--accent-teal)', values: report.trendCumulative }]}
                />
              </Panel>

              <Panel title="Daily Activity" subtitle="Green where the period was in profit, red where it was not.">
                <ActivityStrip buckets={report.series} />
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
              <Panel title="Income by Category">
                <BarList
                  items={report.incomeLines.map((line, i) => ({
                    label: line.category,
                    value: line.amount,
                    color: colorAt(i),
                    meta: `${formatPercent(line.pct)} of income · ${line.count} entries`,
                  }))}
                  formatValue={formatCurrency}
                  emptyLabel="No income recorded in this period"
                />
              </Panel>

              <Panel title="Expenses by Category">
                <BarList
                  items={report.expenseLines.map((line, i) => ({
                    label: line.category,
                    value: line.amount,
                    color: colorAt(i),
                    meta: `${formatPercent(line.pct)} of spend · ${line.count} entries`,
                  }))}
                  formatValue={formatCurrency}
                  emptyLabel="No expenses recorded in this period"
                />
              </Panel>
            </Grid>

            <Grid min={300}>
              <Panel title="Spend Mix">
                <Donut
                  segments={report.expenseLines.slice(0, 6).map((line, i) => ({
                    label: line.category,
                    value: line.amount,
                    color: colorAt(i),
                  }))}
                  centerLabel={formatCompact(report.totals.expense)}
                  centerSub="Total spend"
                />
              </Panel>

              <Panel title="Biggest Movements" subtitle="Change in each category against the previous period.">
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
              <Panel title="Unusual Spending" subtitle="Categories where the latest month is far above their own recent norm.">
                <DataTable
                  keyField="category"
                  rows={report.outliers}
                  columns={[
                    { key: 'category', label: 'Category', render: (r) => r.category },
                    { key: 'amount', label: 'This month', align: 'right', render: (r) => formatCurrency(r.amount) },
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
                  <StatTile label="Allocated" value={formatCurrency(report.budgets.totals.target)} />
                  <StatTile
                    label="Spent"
                    value={formatCurrency(report.budgets.totals.actual)}
                    sub={`${formatPercent(report.budgets.totals.used)} of allocation`}
                    tone={report.budgets.totals.used >= 100 ? 'bad' : report.budgets.totals.used >= 85 ? 'warn' : 'good'}
                  />
                  <StatTile
                    label="Projected at period end"
                    value={formatCurrency(report.budgets.totals.projected)}
                    sub={formatPercent(report.budgets.totals.projectedUsed)}
                    tone={report.budgets.totals.projectedUsed > 100 ? 'bad' : 'good'}
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

                <Panel title="Budget Lines" subtitle="Burn rate is the average spent per elapsed day.">
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
                          <Gauge value={r.used ?? 0} max={100} />
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
                  <StatTile label="Total Outstanding" value={formatCurrency(report.debts.totalDebt)} sub={`${report.debts.rows.length} obligations`} />
                  <StatTile
                    label="Monthly Payments"
                    value={formatCurrency(report.debts.totalMonthlyPayment)}
                    sub={`${formatCurrency(report.debts.totalMonthlyInterest)} is interest`}
                  />
                  <StatTile label="Weighted Interest Rate" value={formatPercent(report.debts.weightedRate, 2)} />
                  <StatTile
                    label="Debt Service Coverage"
                    value={report.debts.dscr === null ? '—' : `${report.debts.dscr.toFixed(2)}×`}
                    sub={coverageHint(report.debts.coverage)}
                    tone={report.debts.coverage === 'deficit' ? 'bad' : report.debts.coverage === 'strained' ? 'warn' : 'good'}
                  />
                </Grid>

                {report.debts.neverClears.length > 0 && (
                  <Note tone="bad">
                    {report.debts.neverClears.map((d) => d.name).join(', ')}: the minimum payment does not cover the monthly interest, so the balance never reduces. Raising the payment, or restructuring the rate, is the only route to clearing it.
                  </Note>
                )}

                <Panel title="Payoff Schedule">
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
                  <Panel title="Balance Trajectory" subtitle="Remaining principal month by month. The curve flattens as the balance amortises.">
                    <TrendChart
                      height={220}
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
                  <StatTile label="Stock Value" value={formatCurrency(report.inventory.totals.value)} sub={`${report.inventory.totals.units} units across ${report.inventory.totals.items} items`} />
                  <StatTile
                    label="Low Stock Items"
                    value={report.inventory.totals.lowStockCount}
                    sub={formatCurrency(report.inventory.totals.lowStockValue) + ' tied up'}
                    tone={report.inventory.totals.lowStockCount > 0 ? 'warn' : 'good'}
                  />
                  <StatTile label="Units Sold" value={report.inventory.totals.unitsSold} sub={formatCurrency(report.inventory.totals.revenue) + ' matched revenue'} />
                  <StatTile
                    label="No Movement"
                    value={report.inventory.totals.deadCount}
                    sub={formatCurrency(report.inventory.totals.deadValue) + ' unsold in period'}
                    tone={report.inventory.totals.deadValue > 0 ? 'warn' : 'good'}
                  />
                </Grid>

                {report.inventory.critical.length > 0 && (
                  <Panel title="Reorder Urgency" subtitle="Ranked by how far below the reorder point each item has fallen.">
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

                <Panel title="Stock Detail">
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
                  <StatTile label="Fleet Running Cost" value={formatCurrency(report.fleet.totals.expense)} sub={`${report.fleet.totals.active} of ${report.fleet.totals.vehicles} active`} tone="bad" />
                  <StatTile label="Fleet Revenue" value={formatCurrency(report.fleet.totals.income)} tone="good" />
                  <StatTile label="Fleet Net" value={formatCurrency(report.fleet.totals.net)} tone={report.fleet.totals.net >= 0 ? 'good' : 'bad'} />
                  <StatTile label="Fuel" value={formatCurrency(report.fleet.totals.fuel)} sub={`${formatCurrency(report.fleet.totals.maintenance)} maintenance`} />
                </Grid>

                {report.fleet.underperforming.length > 0 && (
                  <Note tone="warn">
                    {report.fleet.underperforming.map((v) => v.regNo).join(', ')} carry running costs but have no revenue attributed to them. Either they are idle, or their income is being logged without a vehicle registration.
                  </Note>
                )}

                <Panel title="Per Vehicle">
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
              <Panel title="Cash Basis">
                <Facts items={[
                  { label: 'Average monthly income', value: formatCurrency(report.breakEven.avgIncome) },
                  { label: 'Average monthly expenses', value: formatCurrency(report.breakEven.avgExpense) },
                  { label: 'Average monthly net', value: formatCurrency(report.breakEven.avgNet) },
                  { label: 'Revenue needed to break even', value: formatCurrency(report.breakEven.cashBreakEven) },
                  { label: 'Safety margin', value: report.breakEven.safetyMargin === null ? '—' : formatPercent(report.breakEven.safetyMargin) },
                ]} />
              </Panel>

              <Panel title="Modelled Split" subtitle="Estimated by treating certain categories as variable costs.">
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

            <Panel>
              <DataTable
                rows={[
                  ...report.incomeLines.map((l) => ({ group: 'Income', label: l.category, amount: l.amount, pct: l.pct })),
                  ...report.expenseLines.map((l) => ({ group: 'Expense', label: l.category, amount: l.amount, pct: l.pct })),
                ]}
                keyField="label"
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