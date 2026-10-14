import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { accountStatus, suspensionMessage } from '../lib/accountStatus';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutes in milliseconds

const SESSION_KEY = 'tracksimply_session';

/**
 * Session persistence is deliberately asymmetric.
 *
 * Only a superadmin is remembered across browser restarts. Staff sign in for
 * the session and are forgotten when the tab closes.
 *
 * The reason is that accounting and inventory screens are typically used on a
 * shared front-desk machine. A session that survives closing the browser means
 * the next person to open it is already inside the business's books. Staff can
 * still refresh without being thrown out, because their session is held in
 * sessionStorage rather than dropped entirely.
 *
 * This is a safety default, not a security control: it changes where a session
 * is kept, and anyone with developer tools can read either store. It is not a
 * substitute for real credentials, and it does nothing about the fact that two
 * accounts currently share the password 'password'.
 */
function readSession() {
  try {
    const persistent = window.localStorage.getItem(SESSION_KEY);
    if (persistent) {
      const parsed = JSON.parse(persistent);
      if (parsed && parsed.role !== 'superadmin') {
        // A staff session saved before this rule existed. Demote it rather than
        // leaving it remembered.
        window.localStorage.removeItem(SESSION_KEY);
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }

    const tabSession = window.sessionStorage.getItem(SESSION_KEY);
    return tabSession ? JSON.parse(tabSession) : null;
  } catch {
    return null;
  }
}

function persistSession(sessionUser) {
  try {
    if (!sessionUser) {
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    if (sessionUser.role === 'superadmin') {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      window.sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable (private browsing). The session simply will not
    // survive a reload, which is the safe direction to fail in.
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readSession);

  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef(null);

  const logout = useCallback(() => {
    setUser(null);
    persistSession(null);
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

  // Persist the session. A superadmin is remembered across restarts; everyone
  // else is held for the tab only. See persistSession for why.
  useEffect(() => {
    persistSession(user);
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

      /* Deactivation and suspension are checked before the session is created.
         Both are enforced here rather than in the screen, so a suspended user
         cannot reach the app by any route that signs in. */
      const status = accountStatus(data);

      if (status.key === 'inactive') {
        return { success: false, reason: 'This account has been deactivated by an administrator.' };
      }

      if (status.key === 'suspended') {
        return { success: false, reason: suspensionMessage(status) };
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

