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
      { ...newDebt, id: Date.now(), total: parseFloat(newDebt.total), interest: parseFloat(newDebt.interest) || 0, minPayment: parseFloat(newDebt.minPayment) || 0 }
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
        <h2>Debt Tracker</h2>
        <span className="user-badge">{debts.length} active debts</span>
      </div>

      <div className="card summary-card" style={{ background: 'var(--accent-teal)', color: 'white' }}>
        <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '8px' }}>Total Debt Balance</p>
        <h1 style={{ fontSize: '2.5rem' }}>KES {totalDebt.toLocaleString()}</h1>
      </div>

      <div className="card">
        <h3>Add New Debt</h3>
        <form onSubmit={handleAddDebt} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '15px', marginTop: '15px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Debt Name</label>
            <input 
              type="text" 
              placeholder="e.g. Car Loan" 
              value={newDebt.name} 
              onChange={e => setNewDebt({...newDebt, name: e.target.value})} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Amount (KES)</label>
            <input 
              type="number" 
              placeholder="0.00" 
              value={newDebt.total} 
              onChange={e => setNewDebt({...newDebt, total: e.target.value})} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Interest Rate (%)</label>
            <input 
              type="number" 
              placeholder="0.0" 
              value={newDebt.interest} 
              onChange={e => setNewDebt({...newDebt, interest: e.target.value})} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Min. Payment (KES)</label>
            <input 
              type="number" 
              placeholder="0.00" 
              value={newDebt.minPayment} 
              onChange={e => setNewDebt({...newDebt, minPayment: e.target.value})} 
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '14px 30px' }}>Add Debt</button>
        </form>
      </div>

      <div className="card">
        <h3>Active Debts</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Debt Name</th>
                <th>Total Balance</th>
                <th>Interest</th>
                <th>Min. Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {debts.map(debt => (
                <tr key={debt.id}>
                  <td style={{ fontWeight: 600 }}>{debt.name}</td>
                  <td>KES {debt.total.toLocaleString()}</td>
                  <td>{debt.interest}%</td>
                  <td>KES {debt.minPayment.toLocaleString()}</td>
                  <td>
                    <button 
                      onClick={() => handleRemoveDebt(debt.id)}
                      style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Delete
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
