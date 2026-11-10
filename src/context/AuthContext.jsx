import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { accountStatus, suspensionMessage } from '../lib/accountStatus';
import {
  getAuth0Client,
  loginWithAuth0 as startAuth0Login,
  loginWithGoogle as startGoogleLogin,
  logoutFromAuth0,
} from '../lib/auth0';

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

/**
 * Escapes a value for use inside a SQL LIKE pattern. Emails legitimately contain
 * underscores, and an unescaped '_' would match any single character — so
 * `a_b@x.com` could otherwise resolve to `axb@x.com` and hand over that role.
 */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

/**
 * Resolves a verified Auth0 email to exactly one TrackSimply account.
 *
 * Returns `{ account }` or `{ error }`. It never creates an account: if the
 * address is not linked to a row, the sign-in is refused.
 */
async function findAccountByEmail(email) {
  const { data, error } = await supabase
    .from('site_users')
    .select('*')
    .ilike('email', escapeLike(email))
    .limit(2);

  if (error) {
    // 42703 / PGRST204: the column is absent, so migration 0003 has not been
    // applied. Say so plainly instead of reporting a generic connection fault.
    const missingColumn = error.code === '42703' || error.code === 'PGRST204';
    return {
      error: missingColumn
        ? 'Email sign-in is not set up yet: apply supabase/migrations/0003_user_email.sql.'
        : `Could not read accounts: ${error.message || 'unknown error'}`,
    };
  }

  const rows = data || [];
  if (rows.length === 0) {
    // Not an error: a verified identity that no account has claimed yet. The
    // sign-in screen turns this into a "link it to your account" step.
    return { notFound: true };
  }
  if (rows.length > 1) {
    return {
      error: `More than one account uses ${email}. An administrator must resolve that before you can sign in.`,
    };
  }

  return { account: rows[0] };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readSession);

  const [loading, setLoading] = useState(true);
  const [auth0Error, setAuth0Error] = useState('');
  const [auth0JustSignedIn, setAuth0JustSignedIn] = useState(false);
  // A verified address that no account has claimed. Holds the address between
  // the Auth0 return and the moment the visitor proves they own the account.
  const [pendingAuth0Email, setPendingAuth0Email] = useState('');
  const logoutTimerRef = useRef(null);

  const logout = useCallback(async () => {
    const viaAuth0 = Boolean(user?.auth0);

    setUser(null);
    persistSession(null);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

    /* Auth0 keeps its own session cookie on its domain. Ending only the local
       one would make the next "Continue with Auth0" sign the same person
       straight back in, which looks like a broken sign-out. */
    if (viaAuth0) {
      try {
        await logoutFromAuth0();
      } catch {
        // The local session is already gone; a failed redirect is not worth
        // blocking the user behind.
      }
    }
  }, [user]);

  const resetLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (user) {
      logoutTimerRef.current = setTimeout(() => {
        console.log('Inactivity logout triggered');
        logout();
      }, INACTIVITY_LIMIT);
    }
  }, [user, logout]);

  /**
   * Turns a verified Auth0 profile into an app session, or into a pending link
   * for an unclaimed account. Shared by the popup flow and the redirect
   * callback, so the two can never enforce different rules.
   */
  const applyAuth0Profile = useCallback(async (profile) => {
    const verified = Boolean(profile)
      && (profile.email_verified === true || profile.email_verified === 'true');

    if (!verified) {
      setAuth0Error('Your email address is not verified yet. Verify it with Auth0, then sign in again.');
      return;
    }

    const email = String(profile.email || '').trim().toLowerCase();
    if (!email) {
      setAuth0Error('Auth0 did not return an email address for this account.');
      return;
    }

    const match = await findAccountByEmail(email);
    if (match.error) {
      setAuth0Error(match.error);
      return;
    }

    /* No row yet. This is the common case for admin and user: Google has
       verified who they are, but no account has been linked. Rather than a
       dead end that only an administrator can clear, hand them a step that
       asks for their existing username and password. */
    if (match.notFound) {
      setPendingAuth0Email(email);
      return;
    }

    // The same gate the username/password path uses, so a suspension applies
    // however someone signs in.
    const status = accountStatus(match.account);
    if (status.key === 'inactive') {
      setAuth0Error('This account has been deactivated by an administrator.');
      return;
    }
    if (status.key === 'suspended') {
      setAuth0Error(suspensionMessage(status));
      return;
    }

    // The password is deliberately not carried into the session, exactly as on
    // the username/password path.
    setUser({
      id: match.account.id,
      role: match.account.role,
      username: match.account.username,
      email,
      auth0: true,
    });
    setPendingAuth0Email('');
    setAuth0JustSignedIn(true);
  }, []);

  /* Handles the return trip from Auth0's Universal Login. Runs before the app
     renders, so a callback is never half-applied.

     The whole security rule lives in applyAuth0Profile:
       - trust the address only if Auth0 reports it verified
       - it must match exactly one linked row
       - the role comes from that row, never from Auth0
     A stranger who signs up in Auth0 therefore gets nothing: no row, no entry. */
  const hydrateFromAuth0 = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    if (params.has('error')) {
      const description = params.get('error_description') || params.get('error');
      setAuth0Error(String(description).replace(/\+/g, ' '));
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (!params.has('code') || !params.has('state')) return;

    try {
      const client = await getAuth0Client();
      await client.handleRedirectCallback();
      // Strip code/state from the address bar so a reload cannot replay them.
      window.history.replaceState({}, '', window.location.pathname);

      const profile = await client.getUser();
      await applyAuth0Profile(profile);
    } catch (err) {
      setAuth0Error(err && err.message ? err.message : 'Auth0 sign-in failed. Please try again.');
    }
  }, [applyAuth0Profile]);

  const loginWithAuth0 = useCallback(async ({ signup = false } = {}) => {
    setAuth0Error('');
    setPendingAuth0Email('');
    try {
      const profile = await startAuth0Login({ signup });
      await applyAuth0Profile(profile);
    } catch (err) {
      // Closing the window is a cancellation, not a failure worth shouting about.
      // auth0-spa-js reports it as error "cancelled" / message "Popup closed".
      if (err && (err.error === 'cancelled' || err.error === 'popup_closed_by_user')) return;
      if (err && (err.error === 'popup_open_failed' || err.error === 'popup_blocked_by_browser')) {
        setAuth0Error('Your browser blocked the sign-in window. Allow popups for this site, then try again.');
        return;
      }
      setAuth0Error(err && err.message
        ? err.message
        : 'Could not reach Auth0. Check your connection and try again.');
    }
  }, [applyAuth0Profile]);

  const loginWithGoogle = useCallback(async () => {
    setAuth0Error('');
    setPendingAuth0Email('');
    try {
      const profile = await startGoogleLogin();
      await applyAuth0Profile(profile);
    } catch (err) {
      if (err && (err.error === 'cancelled' || err.error === 'popup_closed_by_user')) return;
      if (err && (err.error === 'popup_open_failed' || err.error === 'popup_blocked_by_browser')) {
        setAuth0Error('Your browser blocked the sign-in window. Allow popups for this site, then try again.');
        return;
      }
      setAuth0Error(err && err.message
        ? err.message
        : 'Could not reach Google. Check your connection and try again.');
    }
  }, [applyAuth0Profile]);

  /**
   * Links the verified address to an existing account, from the sign-in screen.
   *
   * This is what makes the rollout self-service: an administrator does not have
   * to collect anyone's email. The person proves they already own the account
   * with its username and password — the same bar as the normal sign-in — while
   * the address itself was proven by Auth0. Nothing about the role changes.
   *
   * On success the account is switched to Auth0-only in the same write, which
   * is the behaviour superadmin already has. From then the password stops
   * working; see the rollback note in 0004_auth0_required.sql.
   */
  const linkAuth0Account = useCallback(async (username, password) => {
    const email = pendingAuth0Email;
    if (!email) {
      return { success: false, reason: 'Start again with Google or Auth0.' };
    }

    try {
      const { data, error } = await supabase
        .from('site_users')
        .select('*')
        .eq('username', username)
        .limit(1);

      if (error || !data || data.length === 0) {
        return { success: false, reason: 'Invalid username or password' };
      }

      const account = data[0];

      // Proving ownership of the existing account. Without this, anyone with a
      // Google account could claim 'admin' by typing its name.
      if (account.password !== password) {
        return { success: false, reason: 'Invalid username or password' };
      }

      const status = accountStatus(account);
      if (status.key === 'inactive') {
        return { success: false, reason: 'This account has been deactivated by an administrator.' };
      }
      if (status.key === 'suspended') {
        return { success: false, reason: suspensionMessage(status) };
      }

      // Never overwrite someone else's link. An account with a different email
      // already belongs to a different identity.
      if (account.email && account.email.toLowerCase() !== email) {
        return {
          success: false,
          reason: 'This account is already linked to a different email. An administrator can change it.',
        };
      }

      const { error: updateError } = await supabase
        .from('site_users')
        .update({ email, auth0_required: true })
        .eq('id', account.id);

      if (updateError) {
        if (updateError.code === '23505') {
          return { success: false, reason: 'That email is already linked to another account.' };
        }
        const missingColumn = updateError.code === '42703' || updateError.code === 'PGRST204';
        return {
          success: false,
          reason: missingColumn
            ? 'Linking needs migrations 0003 and 0004. Apply them in the Supabase SQL Editor, then try again.'
            : `Could not link the email: ${updateError.message || 'unknown error'}`,
        };
      }

      setUser({
        id: account.id,
        role: account.role,
        username: account.username,
        email,
        auth0: true,
      });
      setPendingAuth0Email('');
      setAuth0JustSignedIn(true);
      return { success: true };
    } catch (err) {
      return { success: false, reason: 'Connection error. Please try again.' };
    }
  }, [pendingAuth0Email]);

  const cancelAuth0Link = useCallback(() => {
    setPendingAuth0Email('');
    setAuth0Error('');
  }, []);

  // Migration and Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 0. Finish an Auth0 redirect before anything else, so the app never
        //    renders a signed-out screen for someone who has just signed in.
        await hydrateFromAuth0();

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
      /* Look the account up by username first, then decide. Matching username
         AND password in the query would leave no way to tell "wrong password"
         from "this account has been moved to Auth0", and the second case needs
         to say so instead of pretending the password was wrong. */
      const { data, error } = await supabase
        .from('site_users')
        .select('*')
        .eq('username', username)
        .limit(1);

      if (error || !data || data.length === 0) {
        console.error('Login attempt failed for:', username, error ? `(Error: ${error.message})` : '(User not found)');
        return { success: false, reason: 'Invalid username or password' };
      }

      const account = data[0];

      /* An account that has been moved to Auth0 must not be reachable with a
         password, even the correct one. Without this check, linking an email
         would add a new door while leaving the old shared password wide open. */
      if (account.auth0_required === true) {
        return {
          success: false,
          reason: 'This account now signs in with Auth0. Use "Continue with Auth0" below — a password will not work.',
        };
      }

      if (account.password !== password) {
        return { success: false, reason: 'Invalid username or password' };
      }

      /* Deactivation and suspension are checked before the session is created.
         Both are enforced here rather than in the screen, so a suspended user
         cannot reach the app by any route that signs in. */
      const status = accountStatus(account);

      if (status.key === 'inactive') {
        return { success: false, reason: 'This account has been deactivated by an administrator.' };
      }

      if (status.key === 'suspended') {
        return { success: false, reason: suspensionMessage(status) };
      }

      const sessionUser = { id: account.id, role: account.role, username: account.username };
      setUser(sessionUser);
      return { success: true };
    } catch (err) {
      return { success: false, reason: 'Connection error. Please try again.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        loginWithAuth0,
        loginWithGoogle,
        pendingAuth0Email,
        linkAuth0Account,
        cancelAuth0Link,
        auth0Error,
        auth0JustSignedIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

