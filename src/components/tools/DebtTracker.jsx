import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const DebtTracker = () => {
  const { user } = useAuth();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDebt, setNewDebt] = useState({ name: '', total: '', interest: '', minPayment: '' });

  const fetchDebts = async () => {
    setLoading(true);
    let query = supabase.from('debts').select('*');
    if (!['admin', 'superadmin'].includes(user?.role)) {
      query = query.eq('user_id', user.id);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) setDebts(data);
    setLoading(false);
  };

  useEffect(() => {
    const initData = async () => {
      const { data: remoteCount } = await supabase.from('debts').select('id', { count: 'exact', head: true });
      if (remoteCount === 0) {
        const local = JSON.parse(localStorage.getItem('tracksimply_debts') || '[]');
        if (local.length > 0) {
          const toUpload = local.map(d => ({
            user_id: user.id, name: d.name, total: d.total, interest: d.interest, min_payment: d.minPayment
          }));
          await supabase.from('debts').insert(toUpload);
        }
      }
      fetchDebts();
    };
    if (user) initData();
  }, [user]);

  const handleAddDebt = async (e) => {
    e.preventDefault();
    if (!newDebt.name || !newDebt.total) return;
    
    const { error } = await supabase.from('debts').insert([{
      user_id: user.id,
      name: newDebt.name,
      total: parseFloat(newDebt.total),
      interest: parseFloat(newDebt.interest) || 0,
      min_payment: parseFloat(newDebt.minPayment) || 0
    }]);

    if (!error) {
      setNewDebt({ name: '', total: '', interest: '', minPayment: '' });
      fetchDebts();
    }
  };

  const handleRemoveDebt = async (id) => {
    if (confirm('Remove this debt entry?')) {
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (!error) fetchDebts();
    }
  };

  const totalDebt = debts.reduce((sum, d) => sum + Number(d.total), 0);

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>LIABILITY OVERVIEW</p>
        <h1>Debt Tracking {loading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '10px' }}>(Syncing...)</span>}</h1>
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
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>Min. Payment (KES)</label>
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
                  <td data-label="Debt Name" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{debt.name}</td>
                  <td data-label="Balance">KES {Number(debt.total).toLocaleString()}</td>
                  <td data-label="Interest">{debt.interest}%</td>
                  <td data-label="Payment">KES {Number(debt.min_payment).toLocaleString()}</td>
                  <td data-label="Action">
                    <button 
                      onClick={() => handleRemoveDebt(debt.id)}
                      className="btn-action danger"
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
