import React, { useEffect, useState } from 'react';

const DashboardOverview = ({ onSelectTool }) => {
  const [stats, setStats] = useState({ totalDebt: 0, netProfit: 0, lowStock: 0, budgetUtil: 0 });

  useEffect(() => {
    const debts = JSON.parse(localStorage.getItem('tracksimply_debts') || '[]');
    const txs = JSON.parse(localStorage.getItem('tracksimply_transactions') || '[]');
    const budgets = JSON.parse(localStorage.getItem('tracksimply_budgets') || '[]');
    const inventory = JSON.parse(localStorage.getItem('tracksimply_inventory') || '[]');

    const totalDebt = debts.reduce((sum, d) => sum + d.total, 0);
    const profit = txs.reduce((acc, tx) => acc + (tx.type === 'Income' ? tx.amount : -tx.amount), 0);
    const lowStock = inventory.filter(i => i.stock <= i.reorder).length;
    let totalB = 0, actualB = 0;
    budgets.forEach(b => { totalB += b.budget; actualB += b.actual; });
    setStats({ totalDebt, netProfit: profit, lowStock, budgetUtil: totalB > 0 ? (actualB / totalB) * 100 : 0 });
  }, []);

  const features = [
    { id: 'ai', icon: '✨', title: 'AI Assistant', desc: 'Speak naturally to manage your entire app. Proactive alerts and smart financial logic.' },
    { id: 'debt', icon: '📈', title: 'Debt Mastery', desc: 'Visualize and conquer liabilities with precise tracking of interest rates and payoff goals.', stat: `KES ${stats.totalDebt.toLocaleString()} tracked` },
    { id: 'bookkeeping', icon: '📝', title: 'Business Pulse', desc: 'Log every income and expense. Real-time Profit/Loss for the modern entrepreneur.', stat: `Net: KES ${stats.netProfit.toLocaleString()}` },
    { id: 'budget', icon: '⚖️', title: 'Budget Intelligence', desc: 'Intelligent category-based spending control with live progress indicators.', stat: `${stats.budgetUtil.toFixed(1)}% utilized` },
    { id: 'inventory', icon: '📦', title: 'Active Inventory', desc: 'Real-time stock monitoring with smart reorder alerts. Never run out.', stat: `${stats.lowStock} low stock items` },
  ];

  return (
    <div className="tool-view">
      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
        <p style={{ color: 'var(--accent-teal)', fontWeight: 700, letterSpacing: '2px', marginBottom: '12px', fontSize: '0.8rem' }}>ONE TOOL. ALL YOUR TRACKING.</p>
        <h1 style={{ fontSize: 'clamp(2rem, 7vw, 4.5rem)', marginBottom: '15px' }}>TrackSimply</h1>
        <p style={{ color: 'var(--text-dim)', maxWidth: '700px', margin: '0 auto', fontSize: 'clamp(0.9rem, 2.5vw, 1.15rem)', lineHeight: 1.6 }}>
          The ultimate personal dashboard for debts, bookkeeping, budgets, and inventory. Built for speed, privacy, and absolute clarity.
        </p>
      </div>

      {/* Feature Cards Grid - 1 col mobile, 2 col desktop */}
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
                <span style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', fontSize: '0.85rem', color: 'var(--accent-teal)', fontWeight: 700 }}>
                  {feat.stat}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Why TrackSimply - 1 col mobile, 3 col desktop */}
      <div className="card">
        <h3 style={{ textAlign: 'center', marginBottom: '25px' }}>Why TrackSimply?</h3>
        <div className="grid-cols-3" style={{ gap: '25px', textAlign: 'center' }}>
          <div>
            <h4 style={{ color: 'var(--accent-teal)', marginBottom: '10px' }}>🔒 PRIVACY FIRST</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Your data is stored 100% locally. We never see your numbers.</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent-teal)', marginBottom: '10px' }}>⚡ INSTANT SETUP</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>No delays. Instant interaction, instant results, zero friction.</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent-teal)', marginBottom: '10px' }}>💎 PREMIUM UX</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>A sophisticated experience designed for maximum productivity.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
