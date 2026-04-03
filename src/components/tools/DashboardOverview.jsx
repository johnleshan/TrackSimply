import React, { useEffect, useState } from 'react';

const DashboardOverview = ({ onSelectTool }) => {
  const [stats, setStats] = useState({
    activeDebts: 0,
    totalDebt: 0,
    netProfit: 0,
    budgetUtilization: 0,
    lowStockItems: 0
  });

  useEffect(() => {
    // Read from localStorage to aggregate stats
    const debts = JSON.parse(localStorage.getItem('tracksimply_debts') || '[]');
    const txs = JSON.parse(localStorage.getItem('tracksimply_transactions') || '[]');
    const budgets = JSON.parse(localStorage.getItem('tracksimply_budgets') || '[]');
    const inventory = JSON.parse(localStorage.getItem('tracksimply_inventory') || '[]');

    const totalDebt = debts.reduce((sum, d) => sum + d.total, 0);
    
    const profit = txs.reduce((acc, tx) => {
      return acc + (tx.type === 'Income' ? tx.amount : -tx.amount);
    }, 0);

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
      lowStockItems: lowStock
    });
  }, []);

  return (
    <div className="tool-view">
      <div className="title-section">
        <h2>Dashboard Overview</h2>
        <span className="user-badge" style={{ color: 'var(--accent-teal)' }}>Active Status</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        
        {/* Debt Summary Widget */}
        <div className="card overview-card" onClick={() => onSelectTool('debt')}>
          <div className="overview-icon">💸</div>
          <div className="overview-info">
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '5px' }}>Total Debt Balance</h4>
            <h2 style={{ color: 'var(--text-dark)' }}>KES {stats.totalDebt.toLocaleString()}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '8px' }}>Across {stats.activeDebts} active debts</p>
          </div>
        </div>

        {/* Bookkeeping Summary Widget */}
        <div className="card overview-card" onClick={() => onSelectTool('bookkeeping')}>
          <div className="overview-icon">📊</div>
          <div className="overview-info">
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '5px' }}>Net Profit/Loss</h4>
            <h2 style={{ color: stats.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
               KES {stats.netProfit.toLocaleString()}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>From all logged transactions</p>
          </div>
        </div>

        {/* Budget Summary Widget */}
        <div className="card overview-card" onClick={() => onSelectTool('budget')}>
          <div className="overview-icon">💰</div>
          <div className="overview-info">
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '5px' }}>Budget Utilization</h4>
            <h2 style={{ color: stats.budgetUtilization > 100 ? 'var(--danger)' : 'var(--text-dark)' }}>
              {stats.budgetUtilization.toFixed(1)}%
            </h2>
            <div style={{ height: '6px', background: 'var(--border-soft)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
               <div style={{ 
                  height: '100%', 
                  width: `${Math.min(stats.budgetUtilization, 100)}%`, 
                  background: stats.budgetUtilization > 100 ? 'var(--danger)' : 'var(--accent-teal)' 
                }}></div>
            </div>
          </div>
        </div>

        {/* Inventory Summary Widget */}
        <div className="card overview-card" onClick={() => onSelectTool('inventory')}>
          <div className="overview-icon">📦</div>
          <div className="overview-info">
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '5px' }}>Inventory Status</h4>
            <h2 style={{ color: stats.lowStockItems > 0 ? 'var(--warning)' : 'var(--success)' }}>
               {stats.lowStockItems > 0 ? `${stats.lowStockItems} Low Stock` : 'All Good'}
            </h2>
             <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Items needing attention</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardOverview;
