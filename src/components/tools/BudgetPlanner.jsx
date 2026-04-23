import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const BudgetPlanner = () => {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newBudget, setNewBudget] = useState({ category: '', amount: '' });

  const fetchBudgets = async () => {
    setLoading(true);
    let query = supabase.from('budgets').select('*');
    const { data, error } = await query.order('category', { ascending: true });
    if (!error && data) setBudgets(data);
    setLoading(false);
  };

  useEffect(() => {
    const initData = async () => {
      const { data: remoteCount } = await supabase.from('budgets').select('id', { count: 'exact', head: true });
      if (remoteCount === 0) {
        const local = JSON.parse(localStorage.getItem('tracksimply_budgets') || '[]');
        if (local.length > 0) {
          const toUpload = local.map(b => ({
            user_id: user.id, category: b.category, budget: b.budget, actual: b.actual
          }));
          await supabase.from('budgets').insert(toUpload);
        }
      }
      fetchBudgets();
    };
    if (user) {
      initData();

      // Real-time synchronization
      const channel = supabase
        .channel('budgets-realtime')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'budgets'
        }, () => {
          fetchBudgets();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleAddBudget = async (e) => {
    e.preventDefault();
    if (!newBudget.category || !newBudget.amount) return;
    
    const { error } = await supabase.from('budgets').insert([{
      user_id: user.id,
      category: newBudget.category,
      budget: parseFloat(newBudget.amount),
      actual: 0
    }]);

    if (!error) {
      setNewBudget({ category: '', amount: '' });
      alert('Budget category added successfully!');
      fetchBudgets();
    } else {
      console.error('Error adding budget:', error);
      alert('Failed to add budget category.');
    }
  };

  const handleAddSpend = async (id, currentActual) => {
    const amount = prompt("Enter amount to add to spending:");
    if (!amount || isNaN(amount)) return;
    
    const { error } = await supabase
      .from('budgets')
      .update({ actual: currentActual + parseFloat(amount) })
      .eq('id', id);
    
    if (!error) {
      fetchBudgets();
    } else {
      console.error('Error updating spend:', error);
      alert('Failed to update spend.');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this budget?')) {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (!error) {
        alert('Budget deleted.');
        fetchBudgets();
      } else {
        console.error('Error deleting budget:', error);
        alert('Failed to delete budget.');
      }
    }
  };

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.budget), 0);
  const totalActual = budgets.reduce((sum, b) => sum + Number(b.actual), 0);

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>FINANCIAL GOALS</p>
        <h1>Budget Planning {loading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '10px' }}>(Syncing...)</span>}</h1>
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
                width: `${totalBudget > 0 ? Math.min((totalActual / totalBudget) * 100, 100) : 0}%`, 
                background: totalActual > totalBudget ? 'var(--danger)' : 'var(--accent-teal)',
                transition: 'var(--transition)'
              }}></div>
            </div>
          </div>
          <div style={{ textAlign: 'right', alignSelf: 'center' }}>
             <h2 style={{ color: totalActual > totalBudget ? 'var(--danger)' : 'var(--text-main)', fontSize: '1.5rem' }}>
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
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Target (KES)</label>
            <input type="number" placeholder="0.00" value={newBudget.amount} onChange={e => setNewBudget({...newBudget, amount: e.target.value})} style={{ width: '100%' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Set Budget</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>Budget Allocations</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Target</th>
                <th>Actual</th>
                <th>Utilization</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map(b => (
                <tr key={b.id}>
                  <td data-label="Category" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{b.category}</td>
                  <td data-label="Target">KES {Number(b.budget).toLocaleString()}</td>
                  <td data-label="Actual" style={{ 
                    fontWeight: 700, 
                    color: Number(b.actual) > Number(b.budget) ? 'var(--danger)' : 'var(--success)' 
                  }}>
                    KES {Number(b.actual).toLocaleString()}
                  </td>
                  <td data-label="Utilization">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min((Number(b.actual) / Number(b.budget)) * 100, 100)}%`, 
                          height: '100%', 
                          background: Number(b.actual) > Number(b.budget) ? 'var(--danger)' : 'var(--accent-teal)',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{((Number(b.actual) / Number(b.budget)) * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => handleAddSpend(b.id, Number(b.actual))} className="btn-action">+ Spend</button>
                      {['admin', 'superadmin'].includes(user?.role) && (
                        <button onClick={() => handleDelete(b.id)} className="btn-action danger">Delete</button>
                      )}
                    </div>
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

export default BudgetPlanner;
