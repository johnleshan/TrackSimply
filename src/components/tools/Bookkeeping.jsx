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
        <h2>Business Bookkeeping</h2>
        <span className="user-badge">{transactions.length} total entries</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Income</p>
          <h2 style={{ color: 'var(--success)', marginTop: '5px' }}>KES {totals.income.toLocaleString()}</h2>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Expenses</p>
          <h2 style={{ color: 'var(--danger)', marginTop: '5px' }}>KES {totals.expense.toLocaleString()}</h2>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--accent-teal)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Net Profit</p>
          <h2 style={{ color: 'var(--accent-teal)', marginTop: '5px' }}>KES {netProfit.toLocaleString()}</h2>
        </div>
      </div>

      <div className="card">
        <h3>New Transaction</h3>
        <form onSubmit={handleAddTx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '15px', marginTop: '15px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Description</label>
            <input type="text" placeholder="Transaction details..." value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Amount (KES)</label>
            <input type="number" placeholder="0.00" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type</label>
            <select value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value})} style={{ width: '100%', padding: '12px' }}>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
           <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category</label>
            <input type="text" placeholder="e.g. Sales" value={newTx.category} onChange={e => setNewTx({...newTx, category: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '14px 30px' }}>Log Entry</button>
        </form>
      </div>

      <div className="card">
        <h3>Recent Transactions</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {[...transactions].reverse().map(tx => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td style={{ fontWeight: 500 }}>{tx.description}</td>
                <td><span style={{ padding: '4px 10px', background: 'var(--border-soft)', borderRadius: '12px', fontSize: '0.85rem' }}>{tx.category}</span></td>
                <td style={{ color: tx.type === 'Income' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{tx.type}</td>
                <td style={{ fontWeight: 600 }}>KES {tx.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Bookkeeping;
