import React, { useState, useEffect } from 'react';

const DebtTracker = () => {
  const [debts, setDebts] = useState(() => {
    const saved = localStorage.getItem('tracksimply_debts');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Student Loan', total: 15000, interest: 4.5, minPayment: 150 },
      { id: 2, name: 'Credit Card', total: 2500, interest: 18.9, minPayment: 85 }
    ];
  });

  const [newDebt, setNewDebt] = useState({ name: '', total: '', interest: '', minPayment: '' });

  useEffect(() => {
    localStorage.setItem('tracksimply_debts', JSON.stringify(debts));
  }, [debts]);

  const handleAddDebt = (e) => {
    e.preventDefault();
    if (!newDebt.name || !newDebt.total) return;
    setDebts([
      ...debts, 
      { id: Date.now(), name: newDebt.name, total: parseFloat(newDebt.total), interest: parseFloat(newDebt.interest) || 0, minPayment: parseFloat(newDebt.minPayment) || 0 }
    ]);
    setNewDebt({ name: '', total: '', interest: '', minPayment: '' });
  };

  const handleRemoveDebt = (id) => {
    setDebts(debts.filter(d => d.id !== id));
  };

  const totalDebt = debts.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.9rem', fontWeight: 600 }}>LIABILITY OVERVIEW</p>
        <h1 style={{ fontSize: '2.5rem' }}>Debt Tracking</h1>
        <p style={{ color: 'var(--text-dim)' }}>Manage and analyze your current financial obligations.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>Add New Debt</h3>
          <form onSubmit={handleAddDebt} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Debt Name</label>
              <input type="text" placeholder="e.g. Car Loan" value={newDebt.name} onChange={e => setNewDebt({...newDebt, name: e.target.value})} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Total Balance (KES)</label>
              <input type="number" placeholder="0.00" value={newDebt.total} onChange={e => setNewDebt({...newDebt, total: e.target.value})} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Interest (%)</label>
              <input type="number" placeholder="0.0" value={newDebt.interest} onChange={e => setNewDebt({...newDebt, interest: e.target.value})} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Min. Payment (KES)</label>
              <input type="number" placeholder="0.00" value={newDebt.minPayment} onChange={e => setNewDebt({...newDebt, minPayment: e.target.value})} style={{ width: '100%' }} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px' }}>Log New Obligation</button>
            </div>
          </form>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, var(--accent-teal-soft), transparent)' }}>
          <h3>Total Summary</h3>
          <div style={{ padding: '30px 0', borderBottom: '1px solid var(--glass-border)', marginBottom: '20px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Aggregate Debt</p>
            <h1 style={{ fontSize: '3rem', margin: '10px 0' }}>KES {totalDebt.toLocaleString()}</h1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-dim)' }}>Active Accounts</p>
            <span style={{ background: 'var(--accent-teal)', color: '#0f172a', padding: '4px 12px', borderRadius: '20px', fontWeight: 800 }}>{debts.length}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Active Obligations</h3>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Debt Name</th>
                <th>Current Balance</th>
                <th>Interest Rate</th>
                <th>Monthly Min</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {debts.map(debt => (
                <tr key={debt.id}>
                  <td style={{ fontWeight: 700, color: '#fff' }}>{debt.name}</td>
                  <td>KES {debt.total.toLocaleString()}</td>
                  <td>{debt.interest}%</td>
                  <td>KES {debt.minPayment.toLocaleString()}</td>
                  <td>
                    <button 
                      onClick={() => handleRemoveDebt(debt.id)}
                      style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                    >
                      REMOVE
                    </button>
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

export default DebtTracker;
