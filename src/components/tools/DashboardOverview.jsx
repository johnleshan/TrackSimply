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
      const { data: debtData } = await supabase.from('debts').select('total').eq('user_id', user.id);
      const totalDebt = debtData?.reduce((sum, d) => sum + Number(d.total), 0) || 0;

      // 2. Bookkeeping (Profit) - Filtered by Date Range
      const { data: txData } = await supabase
        .from('transactions')
        .select('amount, type, description, date')
        .eq('user_id', user.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

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
      const { data: invData } = await supabase.from('inventory').select('stock, reorder').eq('user_id', user.id);
      const lowStock = invData?.filter(i => i.stock <= i.reorder).length || 0;

      // 4. Budgets
      const { data: budData } = await supabase.from('budgets').select('budget, actual').eq('user_id', user.id);
      let totalB = 0, actualB = 0;
      budData?.forEach(b => { totalB += Number(b.budget); actualB += Number(b.actual); });
      
      setStats({ 
        totalDebt, 
        netProfit: income - expense, 
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
    { id: 'ai', icon: '✨', title: 'AI Assistant', desc: 'Speak naturally to manage your entire app. Proactive alerts and smart financial logic.' },
    { id: 'debt', icon: '📈', title: 'Debt Mastery', desc: 'Visualize and conquer liabilities with precise tracking of interest rates and payoff goals.', stat: loading ? 'Syncing...' : `KES ${stats.totalDebt.toLocaleString()} tracked` },
    { id: 'bookkeeping', icon: '📝', title: 'Business Pulse', desc: 'Log every income and expense. Real-time Profit/Loss for the modern entrepreneur.', stat: loading ? 'Syncing...' : `Net: KES ${stats.netProfit.toLocaleString()}` },
    { id: 'budget', icon: '⚖️', title: 'Budget Intelligence', desc: 'Intelligent category-based spending control with live progress indicators.', stat: loading ? 'Syncing...' : `${stats.budgetUtil.toFixed(1)}% utilized` },
    { id: 'inventory', icon: '📦', title: 'Active Inventory', desc: 'Real-time stock monitoring with smart reorder alerts. Never run out.', stat: loading ? 'Syncing...' : `${stats.lowStock} low stock items` },
  ];

  return (
    <div className="tool-view">
      {/* Date Range Selector */}
      <div className="card" style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', alignItems: 'center', padding: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>PERIOD START</label>
          <input 
            type="date" 
            value={dateRange.start} 
            onChange={e => setDateRange({...dateRange, start: e.target.value})}
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>PERIOD END</label>
          <input 
            type="date" 
            value={dateRange.end} 
            onChange={e => setDateRange({...dateRange, end: e.target.value})}
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
          />
        </div>
      </div>

      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <p style={{ color: 'var(--accent-teal)', fontWeight: 700, letterSpacing: '2px', marginBottom: '12px', fontSize: '0.8rem' }}>BUSINESS PERFORMANCE</p>
        <div className="grid-cols-3" style={{ gap: '20px', marginBottom: '30px' }}>
          <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>PERIOD INCOME</p>
            <h3 style={{ color: 'var(--success)', marginTop: '5px' }}>KES {performance.income.toLocaleString()}</h3>
          </div>
          <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>PERIOD EXPENSES</p>
            <h3 style={{ color: 'var(--danger)', marginTop: '5px' }}>KES {performance.expense.toLocaleString()}</h3>
          </div>
          <div className="card" style={{ borderLeft: '4px solid var(--accent-teal)' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>PERIOD PROFIT</p>
            <h3 style={{ color: 'var(--accent-teal)', marginTop: '5px' }}>KES {stats.netProfit.toLocaleString()}</h3>
          </div>
        </div>

        <div className="grid-cols-2" style={{ gap: '20px', marginBottom: '20px' }}>
          <div className="card" style={{ background: 'var(--accent-teal-soft)', textAlign: 'left' }}>
            <p style={{ color: 'var(--accent-teal)', fontWeight: 700, fontSize: '0.75rem', marginBottom: '5px' }}>🌟 TOP PERFORMING ITEM</p>
            <h4 style={{ color: 'var(--text-main)' }}>{performance.topItem}</h4>
          </div>
          <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', textAlign: 'left' }}>
            <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.75rem', marginBottom: '5px' }}>⚠️ UNDERPERFORMING ITEM</p>
            <h4 style={{ color: 'var(--text-main)' }}>{performance.underItem}</h4>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid-cols-2" style={{ gap: '20px' }}>
        {features.map(feat => (
          <div key={feat.id} className="card" onClick={() => onSelectTool(feat.id)}
            style={{ cursor: 'pointer', transition: 'var(--transition)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-teal)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '2.5rem', background: 'var(--accent-teal-soft)', padding: '16px', borderRadius: '14px', flexShrink: 0 }}>{feat.icon}</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.7rem)', marginBottom: '8px', color: 'var(--text-main)' }}>{feat.title}</h2>
                <p style={{ color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: '12px', fontSize: '0.9rem' }}>{feat.desc}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <span style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', fontSize: '0.85rem', color: 'var(--accent-teal)', fontWeight: 700 }}>
                    {feat.stat}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Why TrackSimply */}
      <div className="card">
        <h3 style={{ textAlign: 'center', marginBottom: '25px' }}>Why TrackSimply?</h3>
        <div className="grid-cols-3" style={{ gap: '25px', textAlign: 'center' }}>
          <div>
            <h4 style={{ color: 'var(--accent-teal)', marginBottom: '10px' }}>☁️ CLOUD SYNC</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Your data is powered by Supabase. Access it from anywhere, on any device.</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent-teal)', marginBottom: '10px' }}>⚡ INSTANT AUTO-SAVE</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>No delays. Every transaction is saved instantly to the cloud without effort.</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent-teal)', marginBottom: '10px' }}>💎 PREMIUM UX</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>A sophisticated experience designed for maximum productivity and clarity.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
