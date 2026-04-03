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
        <h2>Budget Planner</h2>
        <span className="user-badge">{budgets.length} categories</span>
      </div>

      <div className="card">
        <h3>Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '15px' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Budget Status</p>
            <div style={{ height: '12px', background: 'var(--border-soft)', borderRadius: '6px', margin: '15px 0', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${Math.min((totalActual / totalBudget) * 100, 100)}%`, 
                background: totalActual > totalBudget ? 'var(--danger)' : 'var(--accent-teal)',
                transition: 'var(--transition)'
              }}></div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
             <h2 style={{ color: totalActual > totalBudget ? 'var(--danger)' : 'var(--text-dark)' }}>
              KES {totalActual.toLocaleString()} / KES {totalBudget.toLocaleString()}
            </h2>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>New Category</h3>
        <form onSubmit={handleAddBudget} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '15px', marginTop: '15px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category</label>
           <input type="text" placeholder="e.g. Dining Out" value={newBudget.category} onChange={e => setNewBudget({...newBudget, category: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target Budget (KES)</label>
            <input type="number" placeholder="0.00" value={newBudget.amount} onChange={e => setNewBudget({...newBudget, amount: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '14px 30px' }}>Set Budget</button>
        </form>
      </div>

      <div className="card">
        <h3>Budget Breakdown</h3>
        <div style={{ display: 'grid', gap: '20px', marginTop: '15px' }}>
          {budgets.map(b => {
             const percent = (b.actual / b.budget) * 100;
             const isOver = b.actual > b.budget;
             return (
               <div key={b.id} style={{ padding: '20px', border: '1px solid var(--border-soft)', borderRadius: '12px' }}>
                 <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                   <h4 style={{ color: 'var(--text-dark)' }}>{b.category}</h4>
                   <span style={{ color: isOver ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                     KES {b.actual.toLocaleString()} spent of KES {b.budget.toLocaleString()}
                   </span>
                 </div>
                 <div style={{ height: '8px', background: 'var(--border-soft)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${Math.min(percent, 100)}%`, 
                      background: isOver ? 'var(--danger)' : 'var(--accent-teal)',
                      transition: 'var(--transition)'
                    }}></div>
                 </div>
                 <div style={{ marginTop: '15px', textAlign: 'right' }}>
                    <button className="btn" style={{ background: 'var(--border-soft)', fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => handleAddSpend(b.id)}>+ Add Spending</button>
                    <button className="btn" style={{ background: 'none', color: 'var(--danger)', fontSize: '0.8rem', padding: '6px 12px', border: 'none' }} onClick={() => setBudgets(budgets.filter(x => x.id !== b.id))}>Delete</button>
                 </div>
               </div>
             )
          })}
        </div>
      </div>
    </div>
  );
};

export default BudgetPlanner;
