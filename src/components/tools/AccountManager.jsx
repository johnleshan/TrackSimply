import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const AccountManager = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [showPassword, setShowPassword] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_users')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (!error && data) setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Stealth Filtering: Admins don't see superadmins
  const visibleUsers = users.filter(u => {
    if (currentUser?.role === 'admin' && u.role === 'superadmin') return false;
    return true;
  });

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    
    if (editingId) {
      const { error } = await supabase
        .from('site_users')
        .update({ username: newUser.username, password: newUser.password, role: newUser.role })
        .eq('id', editingId);
      
      if (!error) {
        setEditingId(null);
        fetchUsers();
      }
    } else {
      const { error } = await supabase
        .from('site_users')
        .insert([{ ...newUser, active: true }]);
      
      if (!error) fetchUsers();
    }
    setNewUser({ username: '', password: '', role: 'user' });
    setShowPassword(false);
  };

  const handleToggleStatus = async (user) => {
    // Hierarchy Check
    if (user.role === 'superadmin') {
      alert('Super Admin accounts cannot be deactivated.');
      return;
    }
    if (currentUser?.role === 'admin' && user.role === 'admin') {
      alert('You do not have permission to deactivate other admins.');
      return;
    }

    const { error } = await supabase
      .from('site_users')
      .update({ active: !user.active })
      .eq('id', user.id);
    
    if (!error) fetchUsers();
  };

  const handleEdit = (user) => {
    setNewUser({ username: user.username, password: user.password, role: user.role });
    setEditingId(user.id);
  };

  const handleDelete = async (user) => {
    // Hierarchy Check
    if (user.role === 'superadmin') {
      alert('Super Admin accounts cannot be deleted.');
      return;
    }
    if (currentUser?.role === 'admin' && user.role === 'admin') {
      alert('You do not have permission to delete other admins.');
      return;
    }

    if (confirm(`Are you sure you want to delete ${user.username}?`)) {
      const { error } = await supabase
        .from('site_users')
        .delete()
        .eq('id', user.id);
      
      if (!error) fetchUsers();
    }
  };

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>ADMINISTRATION</p>
        <h1>Account Management</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Create and manage user accounts and permissions.</p>
      </div>

      <div className="card">
        <h3>{editingId ? 'Edit User' : 'Create New User'}</h3>
        <form onSubmit={handleAddUser} className="grid-form" style={{ gap: '15px', marginTop: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Username</label>
            <input 
              type="text" 
              placeholder="Username" 
              value={newUser.username} 
              onChange={e => setNewUser({...newUser, username: e.target.value})} 
              style={{ width: '100%' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Password</label>
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                value={newUser.password} 
                onChange={e => setNewUser({...newUser, password: e.target.value})} 
                style={{ width: '100%' }} 
              />
              <button 
                type="button" 
                className="reveal-btn" 
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Role</label>
            <select 
              value={newUser.role} 
              onChange={e => setNewUser({...newUser, role: e.target.value})} 
              style={{ width: '100%' }}
            >
              <option value="user">User</option>
              {currentUser?.role === 'superadmin' && <option value="admin">Admin</option>}
            </select>
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              {editingId ? 'Update User' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>System Users {loading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '10px' }}>(Syncing...)</span>}</h3>
        <div className="table-container" style={{ marginTop: '15px' }}>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(u => (
                <tr key={u.id}>
                  <td data-label="Username" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.username}</td>
                  <td data-label="Role">
                    <span className={`badge ${u.role === 'superadmin' ? 'badge-purple' : u.role === 'admin' ? 'badge-info' : ''}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td data-label="Status">
                     <span className={`badge ${u.active ? 'badge-success' : 'badge-danger'}`}>
                      {u.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {u.role !== 'superadmin' && !(currentUser?.role === 'admin' && u.role === 'admin') && (
                        <>
                          <button 
                            onClick={() => handleToggleStatus(u)} 
                            className={`btn-action ${u.active ? 'danger' : ''}`}
                            title={u.active ? 'Deactivate Account' : 'Activate Account'}
                          >
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button 
                            onClick={() => handleEdit(u)} 
                            className="btn-action"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(u)} 
                            className="btn-action danger"
                          >
                            Delete
                          </button>
                        </>
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

export default AccountManager;
