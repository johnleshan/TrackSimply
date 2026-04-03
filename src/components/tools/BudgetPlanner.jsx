import React, { useState, useEffect } from 'react';

const BudgetPlanner = () => {
  const [budgets, setBudgets] = useState(() => {
    const saved = localStorage.getItem('tracksimply_budgets');
    return saved ? JSON.parse(saved) : [
      { id: 1, category: 'Housing', budget: 15000, actual: 14500 },
      { id: 2, category: 'Entertainment', budget: 5000, actual: 5500 },
      { id: 3, category: 'Groceries', budget: 8000, actual: 7200 }
    ];
  });

  const [newBudget, setNewBudget] = useState({ category: '', amount: '' });

  useEffect(() => {
    localStorage.setItem('tracksimply_budgets', JSON.stringify(budgets));
  }, [budgets]);

  // AI Sync Listener
  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem('tracksimply_budgets');
      if (saved) setBudgets(JSON.parse(saved));
    };
    window.addEventListener('tracksimply-ai-sync', handleSync);
    return () => window.removeEventListener('tracksimply-ai-sync', handleSync);
  }, []);

  const handleAddBudget = (e) => {
    e.preventDefault();
    if (!newBudget.category || !newBudget.amount) return;
    setBudgets([
      ...budgets, 
      { ...newBudget, id: Date.now(), budget: parseFloat(newBudget.amount), actual: 0 }
    ]);
    setNewBudget({ category: '', amount: '' });
  };

  const handleAddSpend = (id) => {
    const amount = prompt("Enter amount to add to spending:");
    if (!amount || isNaN(amount)) return;
    setBudgets(budgets.map(b => b.id === id ? { ...b, actual: b.actual + parseFloat(amount) } : b));
  };

  const totalBudget = budgets.reduce((sum, b) => sum + b.budget, 0);
  const totalActual = budgets.reduce((sum, b) => sum + b.actual, 0);

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>FINANCIAL GOALS</p>
        <h1>Budget Planning</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Align your spending with your priorities.</p>
      </div>

      <div className="card">
        <h3>Master Oversight</h3>
        <div className="grid-cols-2" style={{ gap: '20px', marginTop: '15px' }}>
          <div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '8px' }}>Global Utilization</p>
            <div style={{ height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${Math.min((totalActual / totalBudget) * 100, 100)}%`, 
                background: totalActual > totalBudget ? 'var(--danger)' : 'var(--accent-teal)',
                transition: 'var(--transition)'
              }}></div>
            </div>
          </div>
          <div style={{ textAlign: 'right', alignSelf: 'center' }}>
             <h2 style={{ color: totalActual > totalBudget ? 'var(--danger)' : '#fff', fontSize: '1.5rem' }}>
              KES {totalActual.toLocaleString()} / KES {totalBudget.toLocaleString()}
            </h2>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>New Category</h3>
        <form onSubmit={handleAddBudget} className="grid-form" style={{ gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Category</label>
           <input type="text" placeholder="e.g. Dining Out" value={newBudget.category} onChange={e => setNewBudget({...newBudget, category: e.target.value})} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Target (KES)</label>
            <input type="number" placeholder="0.00" value={newBudget.amount} onChange={e => setNewBudget({...newBudget, amount: e.target.value})} style={{ width: '100%' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Set Budget</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>Budget Allocations</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Target</th>
                <th>Actual</th>
                <th>Utilization</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map(b => (
                <tr key={b.id}>
                  <td data-label="Category" style={{ fontWeight: 700, color: '#fff' }}>{b.category}</td>
                  <td data-label="Target">KES {b.budget.toLocaleString()}</td>
                  <td data-label="Actual" style={{ 
                    fontWeight: 700, 
                    color: b.actual > b.budget ? 'var(--danger)' : 'var(--success)' 
                  }}>
                    KES {b.actual.toLocaleString()}
                  </td>
                  <td data-label="Utilization">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min((b.actual / b.budget) * 100, 100)}%`, 
                          height: '100%', 
                          background: b.actual > b.budget ? 'var(--danger)' : 'var(--accent-teal)',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{((b.actual / b.budget) * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button onClick={() => handleAddSpend(b.id)} style={{ color: 'var(--accent-teal)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>+ Spend</button>
                      <button onClick={() => setBudgets(budgets.filter(x => x.id !== b.id))} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BudgetPlanner;
