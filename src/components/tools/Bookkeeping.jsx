import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const Bookkeeping = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('business');
  const [loading, setLoading] = useState(true);

  // Unified Cloud State
  const [allTransactions, setAllTransactions] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [newTx, setNewTx] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'Income', category: 'General', qty: 1 });
  const [newVehicleTx, setNewVehicleTx] = useState({ date: new Date().toISOString().split('T')[0], description: '', vehicleReg: '', amount: '', type: 'Expense', category: 'Fuel' });
  
  // Date Range state
  const getWeekRange = () => {
    const now = new Date();
    const first = now.getDate() - now.getDay();
    const last = first + 6;
    return {
      start: new Date(new Date().setDate(first)).toISOString().split('T')[0],
      end: new Date(new Date().setDate(last)).toISOString().split('T')[0]
    };
  };
  const [dateRange, setDateRange] = useState(getWeekRange());

  const [expandedDates, setExpandedDates] = useState({});
  const [expandedTypes, setExpandedTypes] = useState({});

  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data: txs, error: txError } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
    const { data: vehs, error: vehError } = await supabase.from('vehicles').select('*').eq('user_id', user.id).order('reg_no', { ascending: true });
    const { data: inv, error: invError } = await supabase.from('inventory').select('*').eq('user_id', user.id).order('name', { ascending: true });
    
    if (!txError && txs) setAllTransactions(txs);
    if (!vehError && vehs) setVehicles(vehs);
    if (!invError && inv) setInventoryItems(inv);
    setLoading(false);
  };

  useEffect(() => {
    const initData = async () => {
      // One-time migration check
      const localBus = JSON.parse(localStorage.getItem('tracksimply_transactions') || '[]');
      const localVeh = JSON.parse(localStorage.getItem('tracksimply_vehicle_transactions') || '[]');
      
      const { data: remoteCount } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      
      if (remoteCount === 0 && (localBus.length > 0 || localVeh.length > 0)) {
        console.log('Migrating local transactions to cloud...');
        const busToUpload = localBus.map(t => ({
          user_id: user.id, date: t.date, description: t.description, amount: t.amount, 
          type: t.type, category: t.category, source: 'business'
        }));
        const vehToUpload = localVeh.map(t => ({
          user_id: user.id, date: t.date, description: t.description, amount: t.amount, 
          type: t.type, category: t.category, source: 'vehicle', vehicle_reg: t.vehicleReg
        }));
        
        await supabase.from('transactions').insert([...busToUpload, ...vehToUpload]);
      }
      fetchTransactions();
    };

    if (user) {
      initData();

      // Real-time synchronization
      const channel = supabase
        .channel('transactions-realtime')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'transactions'
        }, () => {
          fetchTransactions();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleAddTx = async (e) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount) return;
    
    const qty = parseInt(newTx.qty) || 1;
    const unitPrice = parseFloat(newTx.amount);
    const totalAmount = unitPrice * qty;
    
    // 1. Log the transaction
    const { data: txData, error: txError } = await supabase.from('transactions').insert([{
      user_id: user.id,
      date: newTx.date,
      description: qty > 1 ? `${newTx.description} (x${qty})` : newTx.description,
      amount: totalAmount,
      type: newTx.type,
      category: newTx.category,
      source: 'business'
    }]).select();

    if (!txError && txData) {
      // 2. AUTOMATIC INVENTORY SYNC (Background)
      // We look for any inventory item name that appears in the description
      const descLower = newTx.description.toLowerCase();
      const matchedItem = inventoryItems.find(item => 
        descLower.includes(item.name.toLowerCase())
      );

      if (matchedItem) {
        // Business Logic: 
        // Income (Sale) -> DECREASE stock
        // Expense (Purchase/Restock) -> INCREASE stock
        const delta = newTx.type === 'Income' ? -qty : qty;
        const currentStock = Number(matchedItem.stock) || 0;
        const newStock = Math.max(0, currentStock + delta);
        
        const { error: invError } = await supabase
          .from('inventory')
          .update({ stock: newStock })
          .eq('name', matchedItem.name);
          
        if (invError) {
          console.error('Inventory Sync Error:', invError);
          alert(`Failed to update inventory for ${matchedItem.name}: ${invError.message || 'Unknown error'}`);
        }
      }

      setNewTx({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'Income', category: 'General', qty: 1 });
      alert(matchedItem ? `Logged: ${newTx.description}. Inventory for "${matchedItem.name}" updated!` : 'Transaction logged successfully!');
      fetchTransactions();
    } else {
      console.error('Error logging business transaction:', txError);
      alert('Failed to log transaction.');
    }
  };

  const handleAddVehicleTx = async (e) => {
    e.preventDefault();
    if (!newVehicleTx.description || !newVehicleTx.amount || !newVehicleTx.vehicleReg) return;
    
    const { error } = await supabase.from('transactions').insert([{
      user_id: user.id,
      date: newVehicleTx.date,
      description: newVehicleTx.description,
      amount: parseFloat(newVehicleTx.amount),
      type: newVehicleTx.type,
      category: newVehicleTx.category,
      source: 'vehicle',
      vehicle_reg: newVehicleTx.vehicleReg
    }]);

    if (!error) {
      setNewVehicleTx({ date: new Date().toISOString().split('T')[0], description: '', vehicleReg: '', amount: '', type: 'Expense', category: 'Fuel' });
      alert('Vehicle event logged successfully!');
      fetchTransactions();
    } else {
      console.error('Error logging vehicle event:', error);
      alert('Failed to log event. Check if "transactions" table has "vehicle_reg" column.');
    }
  };

  const handleDelete = async (tx) => {
    if (!confirm('Are you sure you want to delete this record? Inventory changes will be reversed.')) return;

    // Reverse Inventory if it was a stock item
    const desc = tx.description.split(' (x')[0];
    const item = inventoryItems.find(i => i.name.toLowerCase() === desc.toLowerCase());
    
    if (item) {
      // Find quantity from description "Name (xN)"
      const qtyMatch = tx.description.match(/\(x(\d+)\)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
      
      // Reverse: if it was Income (Sale), add back. If Expense (Purchase), subtract.
      const delta = tx.type === 'Income' ? qty : -qty;
      const currentStock = Number(item.stock) || 0;
      const newStock = Math.max(0, currentStock + delta);
      await supabase.from('inventory').update({ stock: newStock }).eq('name', item.name);
    }

    const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
    if (!error) fetchTransactions();
  };

  // Filter transactions by date range
  const filteredTransactions = allTransactions.filter(t => t.date >= dateRange.start && t.date <= dateRange.end);
  const businessTxs = filteredTransactions.filter(t => t.source === 'business');
  const vehicleTxs = filteredTransactions.filter(t => t.source === 'vehicle');

  const busTotals = businessTxs.reduce((acc, tx) => {
    const amt = Number(tx.amount || 0);
    const type = tx.type?.toLowerCase();
    if (type === 'income') acc.income += amt;
    else if (type === 'expense') acc.expense += amt;
    return acc;
  }, { income: 0, expense: 0 });

  const vehTotals = vehicleTxs.reduce((acc, tx) => {
    const amt = Number(tx.amount || 0);
    const type = tx.type?.toLowerCase();
    if (type === 'income') acc.income += amt;
    else if (type === 'expense') acc.expense += amt;
    return acc;
  }, { income: 0, expense: 0 });

  const combinedIncome = busTotals.income + vehTotals.income;
  const combinedExpense = busTotals.expense + vehTotals.expense;
  const combinedProfit = combinedIncome - combinedExpense;

  // Performance metrics for period
  const itemPerformance = businessTxs.reduce((acc, tx) => {
    if (tx.type?.toLowerCase() === 'income') {
      const desc = tx.description.split(' (x')[0]; // Strip quantity for grouping
      acc[desc] = (acc[desc] || 0) + Number(tx.amount);
    }
    return acc;
  }, {});
  const sortedItems = Object.entries(itemPerformance).sort((a, b) => b[1] - a[1]);
  const topItem = sortedItems.length > 0 ? `${sortedItems[0][0]} (KES ${sortedItems[0][1].toLocaleString()})` : 'N/A';
  const underItem = sortedItems.length > 1 ? `${sortedItems[sortedItems.length - 1][0]} (KES ${sortedItems[sortedItems.length - 1][1].toLocaleString()})` : 'N/A';

  // Grouping logic for Business Activity
  const groupedTxs = businessTxs.reduce((acc, tx) => {
    const date = tx.date;
    const dbType = tx.type?.toLowerCase();
    const type = (dbType === 'income') ? 'Income' : 'Expense'; // Normalize for UI grouping
    
    if (!acc[date]) acc[date] = { Income: [], Expense: [], incomeTotal: 0, expenseTotal: 0 };
    acc[date][type].push(tx);
    if (type === 'Income') acc[date].incomeTotal += Number(tx.amount || 0);
    else acc[date].expenseTotal += Number(tx.amount || 0);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedTxs).sort((a, b) => new Date(b) - new Date(a));

  const toggleDate = (date) => setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  const toggleType = (date, type) => setExpandedTypes(prev => ({ ...prev, [`${date}-${type}`]: !prev[`${date}-${type}`] }));

  // Vehicle-specific stats
  const vehicleStats = vehicleTxs.reduce((acc, tx) => {
    const reg = tx.vehicle_reg || 'Unknown';
    if (!acc[reg]) acc[reg] = { income: 0, expense: 0, transactions: [] };
    const amt = Number(tx.amount || 0);
    const type = tx.type?.toLowerCase();
    if (type === 'income') acc[reg].income += amt;
    else if (type === 'expense') acc[reg].expense += amt;
    acc[reg].transactions.push(tx);
    return acc;
  }, {});

  const sortedVehicles = Object.keys(vehicleStats).sort((a, b) => (vehicleStats[b].income - vehicleStats[b].expense) - (vehicleStats[a].income - vehicleStats[a].expense));


  return (
    <div className="tool-view">
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <div className="title-section" style={{ marginBottom: 0 }}>
          <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>TRANSACTION HUB</p>
          <h1>Bookkeeping {loading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '10px' }}>(Syncing...)</span>}</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Monitor income and expense streams for your entire operation.</p>
        </div>
        
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
          {/* Period Selection */}
          <div className="card" style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', alignItems: 'center', padding: '15px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>PERIOD START</label>
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={e => setDateRange({...dateRange, start: e.target.value})}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>PERIOD END</label>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={e => setDateRange({...dateRange, end: e.target.value})}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          <div className="grid-cols-2" style={{ gap: '20px', marginBottom: '20px' }}>
            <div className="card" style={{ background: 'var(--accent-teal-soft)', textAlign: 'left' }}>
              <p style={{ color: 'var(--accent-teal)', fontWeight: 700, fontSize: '0.75rem', marginBottom: '5px' }}>🌟 TOP ITEM (PERIOD)</p>
              <h4 style={{ color: 'var(--text-main)' }}>{topItem}</h4>
            </div>
            <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', textAlign: 'left' }}>
              <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.75rem', marginBottom: '5px' }}>⚠️ UNDERPERFORMING (PERIOD)</p>
              <h4 style={{ color: 'var(--text-main)' }}>{underItem}</h4>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '15px' }}>Log Business Transaction</h3>
            <form onSubmit={handleAddTx} className="grid-form" style={{ gap: '15px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Description</label>
                <input 
                  type="text" 
                  placeholder="Transaction details..." 
                  value={newTx.description} 
                  onChange={e => setNewTx({...newTx, description: e.target.value})} 
                  style={{ width: '100%' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Unit Price (KES)</label>
                <input type="number" placeholder="0.00" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Quantity</label>
                <input type="number" placeholder="1" value={newTx.qty} onChange={e => setNewTx({...newTx, qty: e.target.value})} style={{ width: '100%' }} />
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
                  <option value="Stock/Inventory">Stock/Inventory</option>
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
            <div className="grouped-activity">
              {sortedDates.map(date => (
                <div key={date} className="date-group" style={{ marginBottom: '10px', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div 
                    onClick={() => toggleDate(date)}
                    style={{ 
                      padding: '12px 15px', 
                      background: 'var(--bg-secondary)', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <div style={{ display: 'flex', gap: '15px', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--success)' }}>+ KES {groupedTxs[date].incomeTotal.toLocaleString()}</span>
                      <span style={{ color: 'var(--danger)' }}>- KES {groupedTxs[date].expenseTotal.toLocaleString()}</span>
                      <span>{expandedDates[date] ? '▼' : '▶'}</span>
                    </div>
                  </div>

                  {expandedDates[date] && (
                    <div style={{ padding: '0 10px 10px' }}>
                      {/* Income Section */}
                      {groupedTxs[date].Income.length > 0 && (
                        <div className="type-group">
                          <div 
                            onClick={() => toggleType(date, 'Income')}
                            style={{ padding: '8px 10px', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}
                          >
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>Income ({groupedTxs[date].Income.length})</span>
                            <span>{expandedTypes[`${date}-Income`] ? '−' : '+'}</span>
                          </div>
                          {expandedTypes[`${date}-Income`] && (
                            <div className="table-container" style={{ marginTop: '5px' }}>
                              <table>
                                <tbody>
                                  {groupedTxs[date].Income.sort((a, b) => Number(b.amount) - Number(a.amount)).map(tx => (
                                    <tr key={tx.id}>
                                      <td>{tx.description}</td>
                                      <td>{tx.category}</td>
                                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>+ {Number(tx.amount).toLocaleString()}</td>
                                      <td>
                                        {isAdmin && <button onClick={() => handleDelete(tx)} className="btn-action danger">Delete</button>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expense Section */}
                      {groupedTxs[date].Expense.length > 0 && (
                        <div className="type-group">
                          <div 
                            onClick={() => toggleType(date, 'Expense')}
                            style={{ padding: '8px 10px', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}
                          >
                            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Expenses ({groupedTxs[date].Expense.length})</span>
                            <span>{expandedTypes[`${date}-Expense`] ? '−' : '+'}</span>
                          </div>
                          {expandedTypes[`${date}-Expense`] && (
                            <div className="table-container" style={{ marginTop: '5px' }}>
                              <table>
                                <tbody>
                                  {groupedTxs[date].Expense.sort((a, b) => Number(b.amount) - Number(a.amount)).map(tx => (
                                    <tr key={tx.id}>
                                      <td>{tx.description}</td>
                                      <td>{tx.category}</td>
                                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>- {Number(tx.amount).toLocaleString()}</td>
                                      <td>
                                        {isAdmin && <button onClick={() => handleDelete(tx)} className="btn-action danger">Delete</button>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
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
                <select 
                  value={newVehicleTx.vehicleReg} 
                  onChange={e => setNewVehicleTx({...newVehicleTx, vehicleReg: e.target.value})} 
                  style={{ width: '100%' }}
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.reg_no}>{v.reg_no} ({v.description})</option>
                  ))}
                </select>
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
            <h3 style={{ marginBottom: '20px' }}>Vehicle Performance Comparison</h3>
            <div className="grid-cols-2" style={{ gap: '15px' }}>
              {sortedVehicles.map(reg => {
                const stats = vehicleStats[reg];
                const profit = stats.income - stats.expense;
                return (
                  <div key={reg} className="card" style={{ border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ color: 'var(--accent-teal)', fontSize: '1.2rem' }}>{reg}</h4>
                      <span className={`badge ${profit >= 0 ? 'badge-success' : 'badge-danger'}`}>
                        Profit: KES {profit.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem' }}>
                      <p><span style={{ color: 'var(--text-dim)' }}>Income:</span> <span style={{ color: 'var(--success)', fontWeight: 600 }}>KES {stats.income.toLocaleString()}</span></p>
                      <p><span style={{ color: 'var(--text-dim)' }}>Expenses:</span> <span style={{ color: 'var(--danger)', fontWeight: 600 }}>KES {stats.expense.toLocaleString()}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
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
                  {vehicleTxs.map(tx => (
                    <tr key={tx.id}>
                      <td data-label="Date" style={{ fontSize: '0.85rem' }}>{tx.date}</td>
                      <td data-label="Reg No" style={{ fontWeight: 800, color: 'var(--accent-teal)' }}>{tx.vehicle_reg}</td>
                      <td data-label="Details" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{tx.description}</td>
                      <td data-label="Cat" style={{ fontSize: '0.8rem' }}>{tx.category}</td>
                      <td data-label="Type">
                        <span className={`badge ${tx.type === 'Income' ? 'badge-success' : 'badge-danger'}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td data-label="Amount" style={{ fontWeight: 700, color: tx.type === 'Income' ? 'var(--success)' : 'var(--danger)' }}>
                        {Number(tx.amount).toLocaleString()}
                      </td>
                      <td data-label="Action">
                        {isAdmin && <button onClick={() => handleDelete(tx)} className="btn-action danger">Delete</button>}
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
