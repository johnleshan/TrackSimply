import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const VehicleManagement = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newVehicle, setNewVehicle] = useState({ reg_no: '', description: '' });
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  const fetchVehicles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', user.id)
      .order('reg_no', { ascending: true });
    
    if (!error && data) setVehicles(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchVehicles();
    }
  }, [user]);

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    if (!newVehicle.reg_no) return;

    const { error } = await supabase.from('vehicles').insert([{
      user_id: user.id,
      reg_no: newVehicle.reg_no,
      description: newVehicle.description
    }]);

    if (!error) {
      setNewVehicle({ reg_no: '', description: '' });
      fetchVehicles();
    } else {
      console.error('Error adding vehicle:', error);
      alert(`Failed to add vehicle: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (id) => {
    if (!['admin', 'superadmin'].includes(user?.role)) {
      alert('Only admins can delete vehicles.');
      return;
    }

    if (confirm('Are you sure you want to delete this vehicle?')) {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (!error) fetchVehicles();
    }
  };

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>FLEET MANAGEMENT</p>
        <h1>Vehicle Registry</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Manage your static list of vehicles for easy selection in bookkeeping.</p>
      </div>

      {isAdmin && (
        <div className="card">
          <h3>Register New Vehicle</h3>
          <form onSubmit={handleAddVehicle} className="grid-form" style={{ gap: '15px', marginTop: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Registration No</label>
              <input 
                type="text" 
                placeholder="e.g. KCA 123X" 
                value={newVehicle.reg_no} 
                onChange={e => setNewVehicle({...newVehicle, reg_no: e.target.value.toUpperCase()})} 
                style={{ width: '100%' }} 
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Description/Model</label>
              <input 
                type="text" 
                placeholder="e.g. Isuzu FRR" 
                value={newVehicle.description} 
                onChange={e => setNewVehicle({...newVehicle, description: e.target.value})} 
                style={{ width: '100%' }} 
              />
            </div>
            <div style={{ alignSelf: 'end' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Register Vehicle</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Registered Vehicles {loading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '10px' }}>(Syncing...)</span>}</h3>
        <div className="table-container" style={{ marginTop: '15px' }}>
          <table>
            <thead>
              <tr>
                <th>Reg No</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td data-label="Reg No" style={{ fontWeight: 800, color: 'var(--accent-teal)' }}>{v.reg_no}</td>
                  <td data-label="Description">{v.description || 'N/A'}</td>
                  <td data-label="Actions">
                    {['admin', 'superadmin'].includes(user?.role) && (
                      <button onClick={() => handleDelete(v.id)} className="btn-action danger">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && !loading && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '20px' }}>No vehicles registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VehicleManagement;
