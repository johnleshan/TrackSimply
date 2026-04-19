import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const Bookkeeping = () => {
  const { user } = useAuth();
  // Standard users default to vehicles, admin defaults to business
  const [activeTab, setActiveTab] = useState(user?.role === 'admin' ? 'business' : 'vehicles');

  // Business State
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('tracksimply_transactions');
    return saved ? JSON.parse(saved) : [
      { id: 1, date: '2026-04-01', description: 'Web Design Project', amount: 50000, type: 'Income', category: 'Services' },
      { id: 2, date: '2026-04-02', description: 'Hosting Subscription', amount: 2500, type: 'Expense', category: 'Software' }
    ];
  });
  const [newTx, setNewTx] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'Income', category: 'General' });

  // Vehicles State
  const [vehicleTxs, setVehicleTxs] = useState(() => {
    const saved = localStorage.getItem('tracksimply_vehicle_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [newVehicleTx, setNewVehicleTx] = useState({ date: new Date().toISOString().split('T')[0], description: '', vehicleReg: '', amount: '', type: 'Expense', category: 'Fuel' });

  useEffect(() => {
    localStorage.setItem('tracksimply_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('tracksimply_vehicle_transactions', JSON.stringify(vehicleTxs));
  }, [vehicleTxs]);

  // AI Sync Listener
  useEffect(() => {
    const handleSync = () => {
      const savedBus = localStorage.getItem('tracksimply_transactions');
      if (savedBus) setTransactions(JSON.parse(savedBus));
      const savedVeh = localStorage.getItem('tracksimply_vehicle_transactions');
      if (savedVeh) setVehicleTxs(JSON.parse(savedVeh));
    };
    window.addEventListener('tracksimply-ai-sync', handleSync);
    return () => window.removeEventListener('tracksimply-ai-sync', handleSync);
  }, []);

  const handleAddTx = (e) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount) return;
    setTransactions([
      ...transactions, 
      { ...newTx, id: Date.now(), amount: parseFloat(newTx.amount) }
    ]);
    setNewTx({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'Income', category: 'General' });
  };

  const handleAddVehicleTx = (e) => {
    e.preventDefault();
    if (!newVehicleTx.description || !newVehicleTx.amount || !newVehicleTx.vehicleReg) return;
    setVehicleTxs([
      ...vehicleTxs, 
      { ...newVehicleTx, id: Date.now(), amount: parseFloat(newVehicleTx.amount) }
    ]);
    setNewVehicleTx({ date: new Date().toISOString().split('T')[0], description: '', vehicleReg: '', amount: '', type: 'Expense', category: 'Fuel' });
  };

  const handleDeleteBus = (id) => setTransactions(transactions.filter(t => t.id !== id));
  const handleDeleteVeh = (id) => setVehicleTxs(vehicleTxs.filter(t => t.id !== id));

  const busTotals = transactions.reduce((acc, tx) => {
    if (tx.type === 'Income') acc.income += tx.amount;
    else acc.expense += tx.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const vehTotals = vehicleTxs.reduce((acc, tx) => {
    if (tx.type === 'Income') acc.income += tx.amount;
    else acc.expense += tx.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const combinedIncome = busTotals.income + vehTotals.income;
  const combinedExpense = busTotals.expense + vehTotals.expense;
  const combinedProfit = combinedIncome - combinedExpense;

  // Render role restrictions
  if (user?.role !== 'admin' && activeTab === 'business') {
    setActiveTab('vehicles');
  }

  return (
    <div className="tool-view">
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <div className="title-section" style={{ marginBottom: 0 }}>
          <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>TRANSACTION HUB</p>
          <h1>Bookkeeping</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Monitor income and expense streams for your entire operation.</p>
        </div>
        
        {/* Tab Selection */}
        {user?.role === 'admin' && (
          <div style={{ display: 'flex', gap: '10px', background: 'var(--glass-card)', padding: '5px', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
            <button 
              className={`btn ${activeTab === 'business' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('business')}
              style={{ padding: '8px 20px', minHeight: '36px', borderRadius: '8px', background: activeTab !== 'business' ? 'transparent' : '', color: activeTab !== 'business' ? 'var(--text-main)' : '' }}
            >
              Business
            </button>
            <button 
              className={`btn ${activeTab === 'vehicles' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('vehicles')}
              style={{ padding: '8px 20px', minHeight: '36px', borderRadius: '8px', background: activeTab !== 'vehicles' ? 'transparent' : '', color: activeTab !== 'vehicles' ? 'var(--text-main)' : '' }}
            >
              Vehicles
            </button>
          </div>
        )}
      </div>

      <div className="grid-cols-3" style={{ gap: '20px' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Total Income</p>
          <h2 style={{ color: 'var(--success)', marginTop: '5px' }}>KES {combinedIncome.toLocaleString()}</h2>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Total Expenses</p>
          <h2 style={{ color: 'var(--danger)', marginTop: '5px' }}>KES {combinedExpense.toLocaleString()}</h2>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--accent-teal)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Net Profit</p>
          <h2 style={{ color: 'var(--accent-teal)', marginTop: '5px' }}>KES {combinedProfit.toLocaleString()}</h2>
        </div>
      </div>

      {activeTab === 'business' ? (
        <>
          <div className="card">
            <h3 style={{ marginBottom: '15px' }}>Log Business Transaction</h3>
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
                <select value={newTx.category} onChange={e => setNewTx({...newTx, category: e.target.value})} style={{ width: '100%' }}>
                  <option value="General">General</option>
                  <option value="Sales">Sales</option>
                  <option value="Services">Services</option>
                  <option value="Software">Software</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ alignSelf: 'end' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Log Entry</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '15px' }}>Recent Business Activity</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Details</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...transactions].reverse().map(tx => (
                    <tr key={tx.id}>
                      <td data-label="Date" style={{ fontSize: '0.85rem' }}>{tx.date}</td>
                      <td data-label="Details" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{tx.description}</td>
                      <td data-label="Cat" style={{ fontSize: '0.8rem' }}>{tx.category}</td>
                      <td data-label="Type">
                        <span style={{ 
                          padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                          background: tx.type === 'Income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                          color: tx.type === 'Income' ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {tx.type}
                        </span>
                      </td>
                      <td data-label="Amount" style={{ fontWeight: 700, color: tx.type === 'Income' ? 'var(--success)' : 'var(--danger)' }}>
                        {tx.type === 'Income' ? '+' : '-'} {tx.amount.toLocaleString()}
                      </td>
                      <td data-label="Action">
                        <button onClick={() => handleDeleteBus(tx.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <h3 style={{ marginBottom: '15px' }}>Log Vehicle Event</h3>
            <form onSubmit={handleAddVehicleTx} className="grid-form" style={{ gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Vehicle Reg No</label>
                <input type="text" placeholder="e.g. KCA 123X" value={newVehicleTx.vehicleReg} onChange={e => setNewVehicleTx({...newVehicleTx, vehicleReg: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Description</label>
                <input type="text" placeholder="e.g. Oil Change" value={newVehicleTx.description} onChange={e => setNewVehicleTx({...newVehicleTx, description: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Amount (KES)</label>
                <input type="number" placeholder="0.00" value={newVehicleTx.amount} onChange={e => setNewVehicleTx({...newVehicleTx, amount: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Type</label>
                <select value={newVehicleTx.type} onChange={e => setNewVehicleTx({...newVehicleTx, type: e.target.value})} style={{ width: '100%' }}>
                  <option value="Income">Income (e.g. Cargo Transport)</option>
                  <option value="Expense">Expense (e.g. Fuel, Service)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Category</label>
                <select value={newVehicleTx.category} onChange={e => setNewVehicleTx({...newVehicleTx, category: e.target.value})} style={{ width: '100%' }}>
                  <option value="Fuel">Fuel</option>
                  <option value="Service/Maintenance">Service/Maintenance</option>
                  <option value="Licensing/Insurance">Licensing/Insurance</option>
                  <option value="Revenue">Revenue</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ alignSelf: 'end' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Log Entry</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '15px' }}>Recent Vehicle Activity</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reg No</th>
                    <th>Details</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...vehicleTxs].reverse().map(tx => (
                    <tr key={tx.id}>
                      <td data-label="Date" style={{ fontSize: '0.85rem' }}>{tx.date}</td>
                      <td data-label="Reg No" style={{ fontWeight: 800, color: 'var(--accent-teal)' }}>{tx.vehicleReg}</td>
                      <td data-label="Details" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{tx.description}</td>
                      <td data-label="Cat" style={{ fontSize: '0.8rem' }}>{tx.category}</td>
                      <td data-label="Type">
                        <span style={{ 
                          padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                          background: tx.type === 'Income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                          color: tx.type === 'Income' ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {tx.type}
                        </span>
                      </td>
                      <td data-label="Amount" style={{ fontWeight: 700, color: tx.type === 'Income' ? 'var(--success)' : 'var(--danger)' }}>
                        {tx.type === 'Income' ? '+' : '-'} {tx.amount.toLocaleString()}
                      </td>
                      <td data-label="Action">
                        <button onClick={() => handleDeleteVeh(tx.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Bookkeeping;
