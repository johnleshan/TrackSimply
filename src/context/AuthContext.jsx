import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Init default admin user if no users exist
  useEffect(() => {
    const existingUsers = localStorage.getItem('tracksimply_users');
    if (!existingUsers) {
      const defaultUsers = [
        { id: '1', username: 'admin', password: 'password', role: 'admin' },
        { id: '2', username: 'user', password: 'password', role: 'user' }
      ];
      localStorage.setItem('tracksimply_users', JSON.stringify(defaultUsers));
    }
  }, []);

  const [user, setUser] = useState(() => {
    const savedSession = localStorage.getItem('tracksimply_session');
    return savedSession ? JSON.parse(savedSession) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('tracksimply_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('tracksimply_session');
    }
  }, [user]);

  const login = (username, password) => {
    const users = JSON.parse(localStorage.getItem('tracksimply_users') || '[]');
    const authUser = users.find(u => u.username === username && u.password === password);
    
    if (authUser) {
      setUser({ id: authUser.id, role: authUser.role, username: authUser.username });
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
