import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const InventoryTracker = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: '', stock: '', reorder: '', price: '' });

  const fetchItems = async () => {
    setLoading(true);
    let query = supabase.from('inventory').select('*').eq('user_id', user.id);
    const { data, error } = await query.order('price', { ascending: false });
    if (!error && data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    const initData = async () => {
      const { data: remoteCount } = await supabase.from('inventory').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      if (remoteCount === 0) {
        const local = JSON.parse(localStorage.getItem('tracksimply_inventory') || '[]');
        if (local.length > 0) {
          const toUpload = local.map(i => ({
            user_id: user.id, name: i.name, stock: i.stock, reorder: i.reorder, price: i.price
          }));
          await supabase.from('inventory').insert(toUpload);
        }
      }
      fetchItems();
    };
    if (user) {
      initData();

      // Real-time synchronization
      const channel = supabase
        .channel('inventory-realtime')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'inventory'
        }, () => {
          fetchItems();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.stock) return;
    
    const { error } = await supabase.from('inventory').insert([{
      ...newItem, 
      user_id: user.id, 
      stock: parseInt(newItem.stock), 
      reorder: parseInt(newItem.reorder) || 0, 
      price: parseFloat(newItem.price) || 0 
    }]);

    if (!error) {
      // Log as business transaction
      if (parseInt(newItem.stock) > 0) {
        await supabase.from('transactions').insert([{
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          description: `Initial Stock: ${newItem.name}`,
          amount: parseFloat(newItem.price) * parseInt(newItem.stock),
          type: 'Expense',
          category: 'Stock/Inventory',
          source: 'business'
        }]);
      }
      
      setNewItem({ name: '', stock: '', reorder: '', price: '' });
      alert('Inventory item added successfully!');
      fetchItems();
    } else {
      console.error('Error adding inventory item:', error);
      alert('Failed to add item. Check console for details.');
    }
  };

  const handleStockAdj = async (item, delta) => {
    const currentStock = Number(item.stock) || 0;
    const newStock = Math.max(0, currentStock + delta);
    
    const { error } = await supabase
      .from('inventory')
      .update({ stock: newStock })
      .eq('name', item.name)
      .eq('user_id', user.id);
    
    if (!error) {
      // Log transaction
      const price = Number(item.price) || 0;
      await supabase.from('transactions').insert([{
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        description: `Stock Adj: ${item.name} (${delta > 0 ? '+' : ''}${delta})`,
        amount: Math.abs(delta) * price,
        type: delta > 0 ? 'Expense' : 'Income',
        category: 'Stock/Inventory',
        source: 'business'
      }]);
      
      fetchItems();
    } else {
      console.error('Error adjusting stock:', error);
      alert('Failed to update stock. Check permissions.');
    }
  };


  const handleRemoveItem = async (itemName) => {
    const { error } = await supabase.from('inventory').delete().eq('name', itemName).eq('user_id', user.id);
    if (!error) {
      alert('Item removed.');
      fetchItems();
    } else {
      console.error('Error removing item:', error);
      alert('Failed to remove item.');
    }
  };

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>STOCK MANAGEMENT</p>
        <h1>Inventory Control {loading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '10px' }}>(Syncing...)</span>}</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Real-time oversight of your digital or physical assets.</p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '15px' }}>New Product</h3>
        <form onSubmit={handleAddItem} className="grid-form wide" style={{ gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Product Name</label>
            <input type="text" placeholder="e.g. Spiral Bound" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Stock Qty</label>
            <input type="number" placeholder="0" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: e.target.value})} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Reorder Point</label>
            <input type="number" placeholder="0" value={newItem.reorder} onChange={e => setNewItem({...newItem, reorder: e.target.value})} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Price (KES)</label>
            <input type="number" placeholder="0.00" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} style={{ width: '100%' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Item</button>
        </form>
      </div>

       <div className="card">
        <h3 style={{ marginBottom: '15px' }}>Stock Oversight</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Selling Price</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Stock Adjustment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td data-label="Product Name" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</td>
                  <td data-label="Selling Price">KES {Number(item.price).toLocaleString()}</td>
                  <td data-label="Status">
                    <span className={`badge ${item.stock <= item.reorder ? 'badge-danger' : 'badge-success'}`}>
                      {item.stock <= item.reorder ? 'LOW STOCK' : '✓ IN STOCK'}
                    </span>
                  </td>
                  <td data-label="Stock Adjustment" style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '15px' }}>
                      <button className="btn-action" onClick={() => handleStockAdj(item, -1)}>-</button>
                      <span style={{ fontWeight: 800, minWidth: '40px', color: 'var(--text-main)' }}>{item.stock}</span>
                      <button className="btn-action" onClick={() => handleStockAdj(item, 1)}>+</button>
                    </div>
                  </td>
                  <td data-label="Actions">
                    {['admin', 'superadmin'].includes(user?.role) && (
                      <button onClick={() => handleRemoveItem(item.name)} className="btn-action danger">Remove</button>
                    )}
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

export default InventoryTracker;
