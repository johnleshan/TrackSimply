import React, { useState, useEffect } from 'react';

const Bookkeeping = () => {
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('tracksimply_transactions');
    return saved ? JSON.parse(saved) : [
      { id: 1, date: '2026-04-01', description: 'Web Design Project', amount: 50000, type: 'Income', category: 'Services' },
      { id: 2, date: '2026-04-02', description: 'Hosting Subscription', amount: 2500, type: 'Expense', category: 'Software' }
    ];
  });

  const [newTx, setNewTx] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'Income', category: 'General' });

  useEffect(() => {
    localStorage.setItem('tracksimply_transactions', JSON.stringify(transactions));
  }, [transactions]);

  const handleAddTx = (e) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount) return;
    setTransactions([
      ...transactions, 
      { ...newTx, id: Date.now(), amount: parseFloat(newTx.amount) }
    ]);
    setNewTx({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'Income', category: 'General' });
  };

  const totals = transactions.reduce((acc, tx) => {
    if (tx.type === 'Income') acc.income += tx.amount;
    else acc.expense += tx.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const netProfit = totals.income - totals.expense;

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>TRANSACTION HUB</p>
        <h1>Bookkeeping</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Monitor income and expense streams for your venture.</p>
      </div>

      <div className="grid-cols-3" style={{ gap: '20px' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Total Income</p>
          <h2 style={{ color: 'var(--success)', marginTop: '5px' }}>KES {totals.income.toLocaleString()}</h2>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Total Expenses</p>
          <h2 style={{ color: 'var(--danger)', marginTop: '5px' }}>KES {totals.expense.toLocaleString()}</h2>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--accent-teal)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Net Profit</p>
          <h2 style={{ color: 'var(--accent-teal)', marginTop: '5px' }}>KES {netProfit.toLocaleString()}</h2>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '15px' }}>Log Transaction</h3>
        <form onSubmit={handleAddTx} className="grid-form" style={{ gap: '15px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Description</label>
            <input type="text" placeholder="Transaction details..." value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Amount (KES)</label>
            <input type="number" placeholder="0.00" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Type</label>
            <select value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value})} style={{ width: '100%' }}>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
           <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Category</label>
            <input type="text" placeholder="e.g. Sales" value={newTx.category} onChange={e => setNewTx({...newTx, category: e.target.value})} style={{ width: '100%' }} />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Log Entry</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '15px' }}>Recent Activity</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Details</th>
                <th>Category</th>
                <th>Type</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...transactions].reverse().map(tx => (
                <tr key={tx.id}>
                  <td>{tx.date}</td>
                  <td style={{ fontWeight: 700, color: '#fff' }}>{tx.description}</td>
                  <td><span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '0.75rem' }}>{tx.category}</span></td>
                  <td style={{ color: tx.type === 'Income' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{tx.type}</td>
                  <td style={{ fontWeight: 700 }}>KES {tx.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Bookkeeping;
