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

  // AI Sync Listener
  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem('tracksimply_debts');
      if (saved) setDebts(JSON.parse(saved));
    };
    window.addEventListener('tracksimply-ai-sync', handleSync);
    return () => window.removeEventListener('tracksimply-ai-sync', handleSync);
  }, []);

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
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>LIABILITY OVERVIEW</p>
        <h1>Debt Tracking</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Analyze and pay off your current obligations.</p>
      </div>

      <div className="grid-cols-2" style={{ gap: '25px', alignItems: 'start' }}>
        {/* Summary Card */}
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--accent-teal-soft), transparent)', order: -1 }}>
          <h3>Total Summary</h3>
          <div style={{ padding: '20px 0', borderBottom: '1px solid var(--glass-border)', marginBottom: '15px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Aggregate Debt</p>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '5px 0' }}>KES {totalDebt.toLocaleString()}</h1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Active Accounts</p>
            <span style={{ background: 'var(--accent-teal)', color: '#0f172a', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '0.85rem' }}>{debts.length}</span>
          </div>
        </div>

        {/* Add Form */}
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>Add New Debt</h3>
          <form onSubmit={handleAddDebt} className="grid-form" style={{ gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>Debt Name</label>
              <input type="text" placeholder="e.g. Car Loan" value={newDebt.name} onChange={e => setNewDebt({...newDebt, name: e.target.value})} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>Total Balance (KES)</label>
              <input type="number" placeholder="0.00" value={newDebt.total} onChange={e => setNewDebt({...newDebt, total: e.target.value})} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>Interest (%)</label>
              <input type="number" placeholder="0.0" value={newDebt.interest} onChange={e => setNewDebt({...newDebt, interest: e.target.value})} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>Min. Payment (KES)</label>
              <input type="number" placeholder="0.00" value={newDebt.minPayment} onChange={e => setNewDebt({...newDebt, minPayment: e.target.value})} style={{ width: '100%' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Debt</button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '15px' }}>Active Obligations</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Debt Name</th>
                <th>Balance</th>
                <th>Interest</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {debts.map(debt => (
                <tr key={debt.id}>
                  <td data-label="Debt Name" style={{ fontWeight: 700, color: '#fff' }}>{debt.name}</td>
                  <td data-label="Balance">KES {debt.total.toLocaleString()}</td>
                  <td data-label="Interest">{debt.interest}%</td>
                  <td data-label="Payment">KES {debt.minPayment.toLocaleString()}</td>
                  <td data-label="Action">
                    <button 
                      onClick={() => handleRemoveDebt(debt.id)}
                      style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}
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
