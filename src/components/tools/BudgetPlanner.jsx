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
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Target Budget (KES)</label>
            <input type="number" placeholder="0.00" value={newBudget.amount} onChange={e => setNewBudget({...newBudget, amount: e.target.value})} style={{ width: '100%' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Set Budget</button>
        </form>
      </div>

      <div className="grid-cols-2" style={{ gap: '20px' }}>
        {budgets.map(b => {
           const percent = (b.actual / b.budget) * 100;
           const isOver = b.actual > b.budget;
           return (
             <div key={b.id} className="card" style={{ padding: '20px' }}>
               <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                 <h4 style={{ color: '#fff' }}>{b.category}</h4>
                 <span style={{ color: isOver ? 'var(--danger)' : 'var(--text-dim)', fontWeight: 600, fontSize: '0.85rem' }}>
                   {percent.toFixed(0)}%
                 </span>
               </div>
               <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${Math.min(percent, 100)}%`, 
                      background: isOver ? 'var(--danger)' : 'var(--accent-teal)',
                      transition: 'var(--transition)'
                    }}></div>
               </div>
               <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                 KES {b.actual.toLocaleString()} spent of KES {b.budget.toLocaleString()}
               </p>
               <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                   <button className="btn btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', color: '#fff' }} onClick={() => handleAddSpend(b.id)}>Add Spend</button>
                   <button className="btn" style={{ padding: '10px', background: 'rgba(244,63,94,0.1)', color: 'var(--danger)', fontSize: '0.8rem' }} onClick={() => setBudgets(budgets.filter(x => x.id !== b.id))}>Delete</button>
               </div>
             </div>
           )
        })}
      </div>
    </div>
  );
};

export default BudgetPlanner;
