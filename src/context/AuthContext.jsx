import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutes in milliseconds

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedSession = localStorage.getItem('tracksimply_session');
    return savedSession ? JSON.parse(savedSession) : null;
  });

  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef(null);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('tracksimply_session');
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  }, []);

  const resetLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (user) {
      logoutTimerRef.current = setTimeout(() => {
        console.log('Inactivity logout triggered');
        logout();
      }, INACTIVITY_LIMIT);
    }
  }, [user, logout]);

  // Migration and Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Check if we need to migrate or seed default users
        const { data: remoteUsers, error } = await supabase.from('site_users').select('id').limit(1);
        
        if (!error && (!remoteUsers || remoteUsers.length === 0)) {
          console.log('Seeding cloud database with default/local accounts...');
          
          const localUsers = JSON.parse(localStorage.getItem('tracksimply_users') || '[]');
          
          // Default system accounts (fallback if local is empty)
          const defaultUsers = [
            { username: 'superadmin', password: 'password', role: 'superadmin', active: true },
            { username: 'admin', password: 'password', role: 'admin', active: true },
            { username: 'user', password: 'password', role: 'user', active: true }
          ];

          const accountsToUpload = localUsers.length > 0 ? localUsers : defaultUsers;
          
          // Upload to Supabase (site_users table)
          // Note: we remove local IDs to let Supabase generate UUIDs
          const formatted = accountsToUpload.map(({ username, password, role, active }) => ({
            username, password, role, active
          }));

          await supabase.from('site_users').insert(formatted);
          console.log('Seeding/Migration complete.');
        }
      } catch (err) {
        console.error('Auth Initialization Error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Inactivity Listeners
  useEffect(() => {
    if (user) {
      const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
      const handleActivity = () => resetLogoutTimer();

      events.forEach(event => window.addEventListener(event, handleActivity));
      resetLogoutTimer();

      return () => {
        events.forEach(event => window.removeEventListener(event, handleActivity));
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      };
    }
  }, [user, resetLogoutTimer]);

  // Sync session to LocalStorage (for fast initial load)
  useEffect(() => {
    if (user) {
      localStorage.setItem('tracksimply_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('tracksimply_session');
    }
  }, [user]);

  const login = async (username, password) => {
    try {
      const { data, error } = await supabase
        .from('site_users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();
      
      if (error || !data) {
        console.error('Login attempt failed for:', username, error ? `(Error: ${error.message})` : '(User not found or password mismatch)');
        return { success: false, reason: 'Invalid username or password' };
      }

      console.log('Login successful for:', username);

      if (!data.active) {
        return { success: false, reason: 'This account has been deactivated by an admin.' };
      }

      const sessionUser = { id: data.id, role: data.role, username: data.username };
      setUser(sessionUser);
      return { success: true };
    } catch (err) {
      return { success: false, reason: 'Connection error. Please try again.' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

