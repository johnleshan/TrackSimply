import React, { useEffect, useState } from 'react';

const DashboardOverview = ({ onSelectTool }) => {
  const [stats, setStats] = useState({
    activeDebts: 0,
    totalDebt: 0,
    netProfit: 0,
    budgetUtilization: 0,
    lowStockItems: 0,
    totalSales: 0,
    lastUpdate: ''
  });

  useEffect(() => {
    // Read from localStorage to aggregate stats across the platform
    const debts = JSON.parse(localStorage.getItem('tracksimply_debts') || '[]');
    const txs = JSON.parse(localStorage.getItem('tracksimply_transactions') || '[]');
    const budgets = JSON.parse(localStorage.getItem('tracksimply_budgets') || '[]');
    const inventory = JSON.parse(localStorage.getItem('tracksimply_inventory') || '[]');

    const totalDebt = debts.reduce((sum, d) => sum + d.total, 0);
    
    const profit = txs.reduce((acc, tx) => {
      return acc + (tx.type === 'Income' ? tx.amount : -tx.amount);
    }, 0);

    const income = txs.reduce((acc, tx) => acc + (tx.type === 'Income' ? tx.amount : 0), 0);

    let totalB = 0;
    let actualB = 0;
    budgets.forEach(b => {
      totalB += b.budget;
      actualB += b.actual;
    });
    const budgetUtil = totalB > 0 ? (actualB / totalB) * 100 : 0;

    const lowStock = inventory.filter(i => i.stock <= i.reorder).length;

    setStats({
      activeDebts: debts.length,
      totalDebt,
      netProfit: profit,
      budgetUtilization: budgetUtil,
      lowStockItems: lowStock,
      totalSales: income,
      lastUpdate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }, []);

  const renderProgress = (val, color) => (
    <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden', marginTop: '10px' }}>
      <div style={{ height: '100%', width: `${Math.min(val, 100)}%`, background: color, transition: 'width 1s cubic-bezier(0.23, 1, 0.32, 1)' }} />
    </div>
  );

  return (
    <div className="tool-view">
      <div className="title-section" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '20px' }}>
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.9rem', fontWeight: 600 }}>WELCOME BACK TO TRACKSIMPLY</p>
        <h1 style={{ fontSize: '3rem' }}>Command Center</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1rem' }}>Last activity sync: Today at {stats.lastUpdate}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '25px' }}>
        <div className="card stat-widget" style={{ borderLeft: '3px solid var(--accent-teal)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '10px' }}>TOTAL INCOME</p>
          <h2 style={{ fontSize: '1.8rem', color: '#fff' }}>KES {stats.totalSales.toLocaleString()}</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '8px' }}>+12% vs last month</p>
        </div>
        <div className="card stat-widget" style={{ borderLeft: '3px solid var(--danger)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '10px' }}>OUTSTANDING DEBT</p>
          <h2 style={{ fontSize: '1.8rem', color: '#fff' }}>KES {stats.totalDebt.toLocaleString()}</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>Across {stats.activeDebts} active debts</p>
        </div>
        <div className="card stat-widget" style={{ borderLeft: '3px solid var(--success)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '10px' }}>NET PROFIT</p>
          <h2 style={{ fontSize: '1.8rem', color: stats.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            KES {stats.netProfit.toLocaleString()}
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>After operational costs</p>
        </div>
        <div className="card stat-widget" style={{ borderLeft: '3px solid var(--warning)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '10px' }}>LOW STOCK ITEMS</p>
          <h2 style={{ fontSize: '1.8rem', color: stats.lowStockItems > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {stats.lowStockItems} Items
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>Needing replenishment</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '30px' }}>
        {/* Main Dashboard Interaction Hub */}
        <div className="card" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
          <h3>Tool Hub</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div className="nav-card" onClick={() => onSelectTool('debt')}>
              <div style={{ fontSize: '2rem', marginBottom: '15px' }}>📈</div>
              <h4>Debt Tracker</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '5px' }}>Analyze and pay off liabilities</p>
            </div>
            <div className="nav-card" onClick={() => onSelectTool('bookkeeping')}>
              <div style={{ fontSize: '2rem', marginBottom: '15px' }}>📝</div>
              <h4>Bookkeeping</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '5px' }}>Track business transactions</p>
            </div>
            <div className="nav-card" onClick={() => onSelectTool('budget')}>
              <div style={{ fontSize: '2rem', marginBottom: '15px' }}>⚖️</div>
              <h4>Budget Planner</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '5px' }}>Monthly category oversight</p>
            </div>
            <div className="nav-card" onClick={() => onSelectTool('inventory')}>
              <div style={{ fontSize: '2rem', marginBottom: '15px' }}>📦</div>
              <h4>Inventory Management</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '5px' }}>Stock reorder and sales</p>
            </div>
          </div>
        </div>

        {/* Overview Budget Card */}
        <div className="card" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
          <h3>Budget Overview</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '20px' }}>Overall spending utilization</p>
          <div style={{ textAlign: 'center', margin: '30px 0' }}>
            <h1 style={{ fontSize: '4rem', margin: 0, fontWeight: 800 }}>{stats.budgetUtilization.toFixed(0)}%</h1>
            <p style={{ color: 'var(--text-dim)', marginTop: '10px' }}>TOTAL BUDGET UTILIZED</p>
          </div>
          {renderProgress(stats.budgetUtilization, stats.budgetUtilization > 100 ? 'var(--danger)' : 'var(--accent-teal)')}
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '20px', textAlign: 'center' }}>
            {stats.budgetUtilization > 100 ? 'You have exceeded your overall budget limit.' : 'You are currently within your budget goals.'}
          </p>
        </div>
      </div>

      <style>{`
        .stat-widget {
          padding: 24px;
          cursor: default;
        }
        .nav-card {
          padding: 30px;
          border-radius: var(--radius-lg);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          cursor: pointer;
          transition: var(--transition);
        }
        .nav-card:hover {
          background: rgba(34, 211, 238, 0.08);
          border-color: var(--accent-teal);
          transform: translateY(-5px);
        }
      `}</style>
    </div>
  );
};

export default DashboardOverview;
