import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const DashboardOverview = ({ onSelectTool }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalDebt: 0, netProfit: 0, lowStock: 0, budgetUtil: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const userId = user?.id;
        const isAdmin = ['admin', 'superadmin'].includes(user?.role);

        // 1. Debts
        let debtQuery = supabase.from('debts').select('total');
        const { data: debtData } = await debtQuery;
        const totalDebt = debtData?.reduce((sum, d) => sum + Number(d.total), 0) || 0;

        // 2. Bookkeeping (Profit)
        let txQuery = supabase.from('transactions').select('amount, type');
        const { data: txData } = await txQuery;
        const profit = txData?.reduce((acc, tx) => acc + (tx.type === 'Income' ? Number(tx.amount) : -Number(tx.amount)), 0) || 0;

        // 3. Inventory
        let invQuery = supabase.from('inventory').select('stock, reorder');
        const { data: invData } = await invQuery;
        const lowStock = invData?.filter(i => i.stock <= i.reorder).length || 0;

        // 4. Budgets
        let budQuery = supabase.from('budgets').select('budget, actual');
        const { data: budData } = await budQuery;
        let totalB = 0, actualB = 0;
        budData?.forEach(b => { totalB += Number(b.budget); actualB += Number(b.actual); });
        
        setStats({ 
          totalDebt, 
          netProfit: profit, 
          lowStock, 
          budgetUtil: totalB > 0 ? (actualB / totalB) * 100 : 0 
        });
      } catch (err) {
        console.error('Stats Fetch Error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchStats();

      // Real-time synchronization for all dashboard stats
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
  }, [user]);

  const features = [
    { id: 'ai', icon: '✨', title: 'AI Assistant', desc: 'Speak naturally to manage your entire app. Proactive alerts and smart financial logic.' },
    { id: 'debt', icon: '📈', title: 'Debt Mastery', desc: 'Visualize and conquer liabilities with precise tracking of interest rates and payoff goals.', stat: loading ? 'Syncing...' : `KES ${stats.totalDebt.toLocaleString()} tracked` },
    { id: 'bookkeeping', icon: '📝', title: 'Business Pulse', desc: 'Log every income and expense. Real-time Profit/Loss for the modern entrepreneur.', stat: loading ? 'Syncing...' : `Net: KES ${stats.netProfit.toLocaleString()}` },
    { id: 'budget', icon: '⚖️', title: 'Budget Intelligence', desc: 'Intelligent category-based spending control with live progress indicators.', stat: loading ? 'Syncing...' : `${stats.budgetUtil.toFixed(1)}% utilized` },
    { id: 'inventory', icon: '📦', title: 'Active Inventory', desc: 'Real-time stock monitoring with smart reorder alerts. Never run out.', stat: loading ? 'Syncing...' : `${stats.lowStock} low stock items` },
  ];

  return (
    <div className="tool-view">
      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
        <p style={{ color: 'var(--accent-teal)', fontWeight: 700, letterSpacing: '2px', marginBottom: '12px', fontSize: '0.8rem' }}>ONE TOOL. CLOUD SYNCED.</p>
        <h1 style={{ fontSize: 'clamp(2rem, 7vw, 4.5rem)', marginBottom: '15px' }}>TrackSimply</h1>
        <p style={{ color: 'var(--text-dim)', maxWidth: '700px', margin: '0 auto', fontSize: 'clamp(0.9rem, 2.5vw, 1.15rem)', lineHeight: 1.6 }}>
          The ultimate personal dashboard for debts, bookkeeping, budgets, and inventory. Now with real-time cloud persistence for all your devices.
        </p>
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
