import React, { useState, useEffect } from 'react';

const InventoryTracker = () => {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('tracksimply_inventory');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Eco-Friendly Notebook', stock: 45, reorder: 10, price: 1200 },
      { id: 2, name: 'Premium Planner', stock: 12, reorder: 5, price: 3500 },
      { id: 3, name: 'Desktop Organizer', stock: 8, reorder: 10, price: 2800 }
    ];
  });

  const [newItem, setNewItem] = useState({ name: '', stock: '', reorder: '', price: '' });

  useEffect(() => {
    localStorage.setItem('tracksimply_inventory', JSON.stringify(items));
  }, [items]);

  // AI Sync Listener
  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem('tracksimply_inventory');
      if (saved) setItems(JSON.parse(saved));
    };
    window.addEventListener('tracksimply-ai-sync', handleSync);
    return () => window.removeEventListener('tracksimply-ai-sync', handleSync);
  }, []);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.stock) return;
    setItems([
      ...items, 
      { ...newItem, id: Date.now(), stock: parseInt(newItem.stock), reorder: parseInt(newItem.reorder) || 0, price: parseFloat(newItem.price) || 0 }
    ]);
    setNewItem({ name: '', stock: '', reorder: '', price: '' });
  };

  const handleStockAdj = (id, delta) => {
    setItems(items.map(item => item.id === id ? { ...item, stock: Math.max(0, item.stock + delta) } : item));
  };

  const handleRemoveItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>STOCK MANAGEMENT</p>
        <h1>Inventory Control</h1>
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
                  <td style={{ fontWeight: 700, color: '#fff' }}>{item.name}</td>
                  <td>KES {item.price.toLocaleString()}</td>
                  <td>
                    {item.stock <= item.reorder ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 800, fontSize: '0.75rem', background: 'rgba(244,63,94,0.1)', padding: '4px 10px', borderRadius: '20px' }}>LOW STOCK</span>
                    ) : (
                      <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: '0.75rem', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: '20px' }}>✓ IN STOCK</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '15px' }}>
                      <button className="btn" style={{ padding: '4px 10px', minHeight: '34px', background: 'rgba(255,255,255,0.05)', color: '#fff' }} onClick={() => handleStockAdj(item.id, -1)}>-</button>
                      <span style={{ fontWeight: 800, minWidth: '40px', color: '#fff' }}>{item.stock}</span>
                      <button className="btn" style={{ padding: '4px 10px', minHeight: '34px', background: 'rgba(255,255,255,0.05)', color: '#fff' }} onClick={() => handleStockAdj(item.id, 1)}>+</button>
                    </div>
                  </td>
                  <td>
                    <button 
                      onClick={() => handleRemoveItem(item.id)}
                      style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem' }}
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

export default InventoryTracker;
