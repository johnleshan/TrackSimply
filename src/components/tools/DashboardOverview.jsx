import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const DashboardOverview = ({ onSelectTool }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalDebt: 0, netProfit: 0, lowStock: 0, budgetUtil: 0 });
  const [performance, setPerformance] = useState({ topItem: 'N/A', underItem: 'N/A', income: 0, expense: 0 });
  const [loading, setLoading] = useState(true);
  
  // Default to current week
  const getWeekRange = () => {
    const now = new Date();
    const first = now.getDate() - now.getDay();
    const last = first + 6;
    return {
      start: new Date(now.setDate(first)).toISOString().split('T')[0],
      end: new Date(now.setDate(last)).toISOString().split('T')[0]
    };
  };

  const [dateRange, setDateRange] = useState(getWeekRange());

  const fetchStats = async () => {
    setLoading(true);
    try {
      // 1. Debts
      let debtQuery = supabase.from('debts').select('total');
      if (user.role !== 'superadmin') debtQuery = debtQuery.eq('user_id', user.id);
      const { data: debtData } = await debtQuery;
      const totalDebt = debtData?.reduce((sum, d) => sum + Number(d.total), 0) || 0;

      // 2. Bookkeeping (Profit) - Filtered by Date Range
      let txQuery = supabase
        .from('transactions')
        .select('amount, type, description, date')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);
      
      if (user.role !== 'superadmin') txQuery = txQuery.eq('user_id', user.id);
      const { data: txData } = await txQuery;

      let income = 0, expense = 0;
      const itemPerformance = {};

      txData?.forEach(tx => {
        const amt = Number(tx.amount);
        const type = tx.type?.toLowerCase();
        if (type === 'income') {
          income += amt;
          itemPerformance[tx.description] = (itemPerformance[tx.description] || 0) + amt;
        } else if (type === 'expense') {
          expense += amt;
        }
      });

      const sortedItems = Object.entries(itemPerformance).sort((a, b) => b[1] - a[1]);
      const topItem = sortedItems.length > 0 ? `${sortedItems[0][0]} (KES ${sortedItems[0][1].toLocaleString()})` : 'N/A';
      const underItem = sortedItems.length > 1 ? `${sortedItems[sortedItems.length - 1][0]} (KES ${sortedItems[sortedItems.length - 1][1].toLocaleString()})` : 'N/A';

      // 3. Inventory
      let invQuery = supabase.from('inventory').select('stock, reorder');
      if (user.role !== 'superadmin') invQuery = invQuery.eq('user_id', user.id);
      const { data: invData } = await invQuery;
      const lowStock = invData?.filter(i => i.stock <= i.reorder).length || 0;

      // 4. Budgets
      let budQuery = supabase.from('budgets').select('budget, actual');
      if (user.role !== 'superadmin') budQuery = budQuery.eq('user_id', user.id);
      const { data: budData } = await budQuery;
      let totalB = 0, actualB = 0;
      // Coerce per value: a single NULL or non-numeric amount would otherwise
      // poison the total to NaN and silently report "0% utilized".
      budData?.forEach(b => {
        totalB += Number(b.budget) || 0;
        actualB += Number(b.actual) || 0;
      });
      
      setStats({ 
        totalDebt, 
        netProfit: income - expense,
        transactionCount: txData?.length || 0,
        lowStock, 
        budgetUtil: totalB > 0 ? (actualB / totalB) * 100 : 0 
      });

      setPerformance({ topItem, underItem, income, expense });
    } catch (err) {
      console.error('Stats Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStats();

      const channel = supabase
        .channel('dashboard-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' }, () => fetchStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => fetchStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => fetchStats())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, dateRange]);

  const features = [
    { id: 'analytics', icon: '📊', title: 'Business Analytics', desc: 'Profit & loss, cash flow, budget burn rate, debt payoff and fleet economics — derived from your existing records.', stat: loading ? 'Syncing...' : `${stats.transactionCount ?? 0} records analysed` },
    { id: 'ai', icon: '✨', title: 'AI Assistant', desc: 'Speak naturally to manage your entire app. Proactive alerts and smart financial logic.' },
    { id: 'bookkeeping', icon: '📝', title: 'Business Pulse', desc: 'Log every income and expense. Real-time Profit/Loss for the modern entrepreneur.', stat: loading ? 'Syncing...' : `Net: KES ${stats.netProfit.toLocaleString()}` },
    { id: 'budget', icon: '⚖️', title: 'Budget Intelligence', desc: 'Intelligent category-based spending control with live progress indicators.', stat: loading ? 'Syncing...' : `${stats.budgetUtil.toFixed(1)}% utilized` },
    { id: 'inventory', icon: '📦', title: 'Active Inventory', desc: 'Real-time stock monitoring with smart reorder alerts. Never run out.', stat: loading ? 'Syncing...' : `${stats.lowStock} low stock items` },
  ];

const isAllTime = dateRange.start === '1970-01-01';

  return (
    <div className="tool-view">
      {/* Period controls */}
      <div className="card period-bar">
        <div className="period-bar__dates">
          <div className="field">
            <label className="field-label" htmlFor="dash-start">Period Start</label>
            <input
              id="dash-start"
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="dash-end">Period End</label>
            <input
              id="dash-end"
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
        </div>

        <div className="period-bar__actions">
          <button
            className={`btn ${isAllTime ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setDateRange({ start: '1970-01-01', end: '2099-12-31' })}
          >
            Show All Time
          </button>
          <button
            className={`btn ${isAllTime ? 'btn-outline' : 'btn-primary'}`}
            onClick={() => setDateRange(getWeekRange())}
          >
            Reset to Week
          </button>
        </div>
      </div>

      {/* Period summary */}
      <div className="grid-cols-3">
        <div className={`card stat-card stat-card--success ${loading ? 'is-loading' : ''}`}>
          <div className="stat-card__body">
            <span className="stat-card__label">Period Income</span>
            <span className="stat-card__value" style={{ color: 'var(--success-ink)' }}>
              {loading ? '...' : `KES ${performance.income.toLocaleString()}`}
            </span>
          </div>
        </div>

        <div className={`card stat-card stat-card--danger ${loading ? 'is-loading' : ''}`}>
          <div className="stat-card__body">
            <span className="stat-card__label">Period Expenses</span>
            <span className="stat-card__value" style={{ color: 'var(--danger-ink)' }}>
              {loading ? '...' : `KES ${performance.expense.toLocaleString()}`}
            </span>
          </div>
        </div>

        <div className={`card stat-card stat-card--primary ${loading ? 'is-loading' : ''}`}>
          <div className="stat-card__body">
            <span className="stat-card__label">Period Profit</span>
            <span className="stat-card__value" style={{ color: 'var(--primary-ink)' }}>
              {loading ? '...' : `KES ${stats.netProfit.toLocaleString()}`}
            </span>
          </div>
        </div>
      </div>

      {/* Item performance */}
      <div className="grid-cols-2">
        <div className="card">
          <p className="eyebrow">🌟 Top Performing Item</p>
          <h3 className="section-value">{performance.topItem}</h3>
        </div>
        <div className="card">
          <p className="eyebrow" style={{ color: 'var(--danger-ink)' }}>⚠️ Underperforming Item</p>
          <h3 className="section-value">{performance.underItem}</h3>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="grid-cols-2">
        {features.map(feat => (
          <div
            key={feat.id}
            className="card card-link feature-card"
            onClick={() => onSelectTool(feat.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectTool(feat.id);
              }
            }}
          >
            <div className="stat-card">
              <div className="stat-card__icon">{feat.icon}</div>
              <div className="stat-card__body">
                <h3 className="feature-card__title">{feat.title}</h3>
                <p className="section-lead">{feat.desc}</p>
                {feat.stat && <span className="badge badge-primary feature-card__stat">{feat.stat}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Why TrackSimply */}
      <div className="card">
        <h3 className="card-title">Why TrackSimply?</h3>
        <div className="grid-cols-3">
          <div>
            <h4>☁️ Cloud Sync</h4>
            <p className="section-lead">Your data is powered by Supabase. Access it from anywhere, on any device.</p>
          </div>
          <div>
            <h4>⚡ Instant Auto-Save</h4>
            <p className="section-lead">No delays. Every transaction is saved instantly to the cloud without effort.</p>
          </div>
          <div>
            <h4>💎 Premium UX</h4>
            <p className="section-lead">A sophisticated experience designed for maximum productivity and clarity.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
