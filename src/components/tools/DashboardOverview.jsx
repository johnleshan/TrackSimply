import React, { useEffect, useState } from 'react';

const DashboardOverview = ({ onSelectTool }) => {
  const [stats, setStats] = useState({
    totalDebt: 0,
    netProfit: 0,
    lowStock: 0,
    budgetUtil: 0
  });

  useEffect(() => {
    // Read from localStorage to aggregate brief stats for the showcase
    const debts = JSON.parse(localStorage.getItem('tracksimply_debts') || '[]');
    const txs = JSON.parse(localStorage.getItem('tracksimply_transactions') || '[]');
    const budgets = JSON.parse(localStorage.getItem('tracksimply_budgets') || '[]');
    const inventory = JSON.parse(localStorage.getItem('tracksimply_inventory') || '[]');

    const totalDebt = debts.reduce((sum, d) => sum + d.total, 0);
    const profit = txs.reduce((acc, tx) => acc + (tx.type === 'Income' ? tx.amount : -tx.amount), 0);
    const lowStock = inventory.filter(i => i.stock <= i.reorder).length;
    let totalB = 0; let actualB = 0;
    budgets.forEach(b => { totalB += b.budget; actualB += b.actual; });
    const budgetUtil = totalB > 0 ? (actualB / totalB) * 100 : 0;

    setStats({ totalDebt, netProfit: profit, lowStock, budgetUtil });
  }, []);

  const features = [
    {
      id: 'debt',
      icon: '📈',
      title: 'Debt Mastery',
      desc: 'Visualize and conquer liabilities with precise tracking of interest and payoff goals.',
      stat: `Active Balance: KES ${stats.totalDebt.toLocaleString()}`
    },
    {
      id: 'bookkeeping',
      icon: '📝',
      title: 'Business Pulse',
      desc: 'Seamlessly track every income and expense. Real-time Profit/Loss calculation for the modern entrepreneur.',
      stat: `Current Profit: KES ${stats.netProfit.toLocaleString()}`
    },
    {
      id: 'budget',
      icon: '⚖️',
      title: 'Budget Intelligence',
      desc: 'Intelligent category-based spending control with visual progress indicators.',
      stat: `Utilization: ${stats.budgetUtil.toFixed(1)}%`
    },
    {
      id: 'inventory',
      icon: '📦',
      title: 'Active Inventory',
      desc: 'Real-time stock monitoring with smart reorder alerts. Never run out of your best-sellers.',
      stat: `Low Stock: ${stats.lowStock} items`
    }
  ];

  return (
    <div className="tool-view">
      {/* Hero Showcase Section */}
      <div className="hero-showcase" style={{ textAlign: 'center', marginBottom: '50px' }}>
        <p style={{ color: 'var(--accent-teal)', fontWeight: 700, letterSpacing: '2px', marginBottom: '15px' }}>ONE TOOL. ALL YOUR TRACKING.</p>
        <h1 style={{ fontSize: '4.5rem', marginBottom: '20px' }}>TrackSimply</h1>
        <h3 style={{ color: 'var(--text-dim)', maxWidth: '800px', margin: '0 auto', fontSize: '1.25rem', fontWeight: 400 }}>
          The ultimate personal dashboard for managing your debts, business bookkeeping, monthly budgets, and inventory. Built for speed, privacy, and absolute clarity.
        </h3>
      </div>

      {/* Feature Showcase Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px' }}>
        {features.map(feat => (
          <div key={feat.id} className="card feature-card" onClick={() => onSelectTool(feat.id)}>
            <div style={{ display: 'flex', gap: '25px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '3rem', background: 'var(--accent-teal-soft)', padding: '20px', borderRadius: '16px' }}>{feat.icon}</div>
              <div>
                <h2 style={{ fontSize: '1.8rem', marginBottom: '10px', color: '#fff' }}>{feat.title}</h2>
                <p style={{ color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '15px' }}>{feat.desc}</p>
                <div style={{ display: 'inline-block', padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', fontSize: '0.85rem', color: 'var(--accent-teal)', fontWeight: 700 }}>
                  {feat.stat}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Why Choose Section */}
      <div className="card" style={{ marginTop: '50px', background: 'linear-gradient(to bottom right, rgba(255,255,255,0.03), transparent)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px', textAlign: 'center' }}>
          <div>
            <h4 style={{ color: 'var(--accent-teal)', marginBottom: '10px' }}>🔒 PRIVACY FIRST</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Your data is stored 100% locally on your device. We never see your numbers.</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent-teal)', marginBottom: '10px' }}>⚡ INSTANT SETUP</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>No cloud sync delays. Instant interaction, instant results, zero friction.</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent-teal)', marginBottom: '10px' }}>💎 PREMIUM UX</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>A sophisticated experience designed for maximum productivity and aesthetic joy.</p>
          </div>
        </div>
      </div>

      <style>{`
        .feature-card {
          cursor: pointer;
          border: 1px solid var(--glass-border);
          transition: var(--transition);
        }
        .feature-card:hover {
          background: rgba(34, 211, 238, 0.08);
          border-color: var(--accent-teal);
          transform: scale(1.02);
        }
        h1 {
          background: linear-gradient(to bottom, #fff 0%, var(--accent-teal) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
    </div>
  );
};

export default DashboardOverview;
