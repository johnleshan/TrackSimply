import React, { useState, useEffect } from 'react';

const AccountManager = () => {
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('tracksimply_users');
    return saved ? JSON.parse(saved) : [];
  });

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    localStorage.setItem('tracksimply_users', JSON.stringify(users));
  }, [users]);

  const handleAddUser = (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    
    if (editingId) {
      setUsers(users.map(u => u.id === editingId ? { ...newUser, id: editingId } : u));
      setEditingId(null);
    } else {
      setUsers([...users, { ...newUser, id: Date.now().toString() }]);
    }
    setNewUser({ username: '', password: '', role: 'user' });
  };

  const handleEdit = (user) => {
    setNewUser({ username: user.username, password: user.password, role: user.role });
    setEditingId(user.id);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(u => u.id !== id));
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
            <input 
              type="password" 
              placeholder="Password" 
              value={newUser.password} 
              onChange={e => setNewUser({...newUser, password: e.target.value})} 
              style={{ width: '100%' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Role</label>
            <select 
              value={newUser.role} 
              onChange={e => setNewUser({...newUser, role: e.target.value})} 
              style={{ width: '100%' }}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
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
        <h3>System Users</h3>
        <div className="table-container" style={{ marginTop: '15px' }}>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Password</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td data-label="Username" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.username}</td>
                  <td data-label="Role">
                    <span style={{ 
                      padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                      background: u.role === 'admin' ? 'rgba(8, 145, 178, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                      color: u.role === 'admin' ? 'var(--accent-teal)' : 'var(--text-dim)'
                    }}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td data-label="Password" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>••••••••</td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => handleEdit(u)} style={{ color: 'var(--accent-teal)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Edit</button>
                      <button 
                        onClick={() => handleDelete(u.id)} 
                        style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        disabled={u.username === 'admin'}
                      >
                        Delete
                      </button>
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
