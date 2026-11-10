import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useAppSettings } from '../../lib/appSettings';
import {
  accountStatus, suspendUntil, suspensionRemaining, validateReason,
  SUSPENSION_PRESETS, formatDateTime,
} from '../../lib/accountStatus';

/* Inline SVG. The previous eye emoji is a zero-width-joiner sequence that
   renders as a different picture, or an empty box, depending on the platform. */
const EyeIcon = ({ off }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const STATUS_BADGE = { active: 'badge-success', suspended: 'badge-warning', inactive: 'badge-danger' };

/* ------------------------------------------------------------------ *
 * Suspend dialog
 * ------------------------------------------------------------------ */

function SuspendDialog({ user, onCancel, onConfirm, saving, error }) {
  const [reason, setReason] = useState('');
  const [preset, setPreset] = useState('1w');
  const reasonRef = useRef(null);

  useEffect(() => { reasonRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, saving]);

  const chosen = SUSPENSION_PRESETS.find((p) => p.key === preset);
  const preview = suspendUntil(preset);
  const check = validateReason(reason);

  const submit = (e) => {
    e.preventDefault();
    if (!check.ok) return;
    onConfirm(reason, preset);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="suspend-title">
        <div className="modal-head">
          <h3 id="suspend-title">Suspend {user.username}</h3>
          <p>
            They will be unable to sign in until the suspension ends or is lifted. Their records
            are untouched.
          </p>
        </div>

        <form onSubmit={submit} className="modal-body">
          <label className="modal-label" htmlFor="suspend-reason">
            Reason <span className="modal-optional">(shown to the user, optional)</span>
          </label>
          <input
            id="suspend-reason"
            ref={reasonRef}
            type="text"
            className="modal-input"
            placeholder="e.g. Awaiting payment confirmation"
            value={reason}
            maxLength={240}
            onChange={(e) => setReason(e.target.value)}
            disabled={saving}
          />
          {!check.ok && <p className="modal-error">{check.error}</p>}

          <span className="modal-label">Duration</span>
          <div className="modal-presets">
            {SUSPENSION_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`modal-preset ${preset === p.key ? 'is-active' : ''}`}
                aria-pressed={preset === p.key}
                onClick={() => setPreset(p.key)}
                disabled={saving}
              >
                {p.label}
              </button>
            ))}
          </div>

          <p className="modal-note">
            {chosen?.hours === null
              ? 'Lifts only when an administrator lifts it.'
              : `Sign-in returns automatically on ${formatDateTime(preview)}.`}
          </p>

          {error && <p className="modal-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-action" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-action danger" disabled={saving || !check.ok}>
              {saving ? 'Suspending…' : 'Suspend account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Account manager
 * ------------------------------------------------------------------ */

const AccountManager = () => {
  const { user: currentUser } = useAuth();
  const { settings, setSetting, isShared } = useAppSettings();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user', email: '', auth0Required: true });
  const [showPassword, setShowPassword] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [hasEmailColumn, setHasEmailColumn] = useState(false);
  const [hasAuth0RequiredColumn, setHasAuth0RequiredColumn] = useState(false);

  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendSaving, setSuspendSaving] = useState(false);
  const [suspendError, setSuspendError] = useState('');

  const isSuperadmin = currentUser?.role === 'superadmin';

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_users')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setUsers(data);
      // Whether migration 0003 has run. Read from a real row rather than
      // guessing, so ordinary account edits keep working before it is applied.
      if (data.length > 0) {
        setHasEmailColumn(Object.prototype.hasOwnProperty.call(data[0], 'email'));
        setHasAuth0RequiredColumn(Object.prototype.hasOwnProperty.call(data[0], 'auth0_required'));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Stealth Filtering: Admins don't see superadmins
  const visibleUsers = users.filter((u) => {
    if (currentUser?.role === 'admin' && u.role === 'superadmin') return false;
    return true;
  });

  /* An admin cannot act on another admin, and nobody can act on a superadmin.
     Suspension is superadmin-only, which is enforced by not rendering the
     action at all rather than by a check that could be skipped. */
  const canAdminister = (target) =>
    target.role !== 'superadmin' && !(currentUser?.role === 'admin' && target.role === 'admin');

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    setFormError('');

    // Stored lowercased so the Auth0 match is exact and case cannot split one
    // person across two rows.
    const email = String(newUser.email || '').trim().toLowerCase() || null;
    const auth0Required = Boolean(newUser.auth0Required);

    /* An Auth0-only account with no linked address can never sign in, so the
       two are refused together here rather than becoming a support call. */
    if (auth0Required && !email) {
      setFormError('An Auth0-only account needs a Linked email — otherwise there is no way to sign in.');
      return;
    }

    if (auth0Required && !hasAuth0RequiredColumn) {
      setFormError('Auth0-only accounts need migration 0004. Apply supabase/migrations/0004_auth0_required.sql, then try again.');
      return;
    }

    /* Send the column only when it is useful. Before migration 0003 runs it does
       not exist, and adding `email: null` to every request would break ordinary
       account changes. When the column is known to exist, an empty value is sent
       deliberately so an administrator can remove a link. */
    const emailField = (email || hasEmailColumn) ? { email } : {};
    const requiredField = hasAuth0RequiredColumn ? { auth0_required: auth0Required } : {};

    const missingColumn = (error) =>
      error && (error.code === '42703' || error.code === 'PGRST204');

    if (editingId) {
      const { error } = await supabase
        .from('site_users')
        .update({
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          ...emailField,
          ...requiredField,
        })
        .eq('id', editingId);

      if (error) {
        setFormError(missingColumn(error)
          ? 'The email column does not exist yet. Apply supabase/migrations/0003_user_email.sql, then try again.'
          : `Could not update the account: ${error.message || 'unknown error'}`);
        return;
      }
      setEditingId(null);
      fetchUsers();
    } else {
      const { error } = await supabase
        .from('site_users')
        .insert([{
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          ...emailField,
          ...requiredField,
          active: true,
        }]);

      if (error) {
        setFormError(missingColumn(error)
          ? 'The email column does not exist yet. Apply supabase/migrations/0003_user_email.sql, then try again.'
          : `Could not create the account: ${error.message || 'unknown error'}`);
        return;
      }
      fetchUsers();
    }
    setNewUser({ username: '', password: '', role: 'user', email: '', auth0Required: true });
    setShowPassword(false);
  };

  const handleToggleStatus = async (user) => {
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
    setNewUser({
      username: user.username,
      password: user.password,
      role: user.role,
      email: user.email || '',
      auth0Required: Boolean(user.auth0_required),
    });
    setFormError('');
    setEditingId(user.id);
  };

  const handleDelete = async (user) => {
    if (user.role === 'superadmin') {
      alert('Super Admin accounts cannot be deleted.');
      return;
    }
    if (currentUser?.role === 'admin' && user.role === 'admin') {
      alert('You do not have permission to delete other admins.');
      return;
    }

    if (confirm(`Are you sure you want to delete ${user.username}? This cannot be undone.`)) {
      const { error } = await supabase
        .from('site_users')
        .delete()
        .eq('id', user.id);

      if (!error) fetchUsers();
    }
  };

  const applySuspension = async (reason, preset) => {
    if (!suspendTarget) return;
    setSuspendSaving(true);
    setSuspendError('');

    const check = validateReason(reason);
    const { error } = await supabase
      .from('site_users')
      .update({
        suspended_at: new Date().toISOString(),
        suspended_until: suspendUntil(preset),
        suspend_reason: check.value,
      })
      .eq('id', suspendTarget.id);

    setSuspendSaving(false);

    if (error) {
      // 42703 / PGRST204: the column is absent, which means migration 0002 has
      // not been applied. Say so plainly instead of reporting a generic failure.
      const missingColumn = error.code === '42703' || error.code === 'PGRST204';
      setSuspendError(missingColumn
        ? 'The suspension columns do not exist yet. Apply supabase/migrations/0002_user_suspension.sql, then try again.'
        : `Could not suspend the account: ${error.message || 'unknown error'}`);
      return;
    }

    setSuspendTarget(null);
    fetchUsers();
  };

  const liftSuspension = async (user) => {
    if (!confirm(`Lift the suspension on ${user.username}? They will be able to sign in immediately.`)) return;

    const { error } = await supabase
      .from('site_users')
      .update({ suspended_at: null, suspended_until: null, suspend_reason: null })
      .eq('id', user.id);

    if (!error) fetchUsers();
  };

  const now = new Date();

  return (
    <div className="tool-view">
      <div className="title-section">
        <p style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 600 }}>ADMINISTRATION</p>
        <h1>Account Management</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Create and manage user accounts and permissions.</p>
      </div>

      {/* Superadmin only. Applies to this browser, not the whole system. */}
      {isSuperadmin && (
        <div className="card" style={{ marginBottom: '25px' }}>
          <h3>Application Settings</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '6px' }}>
            Report options for the Analytics view.
          </p>

          <label className="settings-row">
            <input
              type="checkbox"
              checked={settings.reportActionsEnabled}
              onChange={(e) => { setSetting('reportActionsEnabled', e.target.checked); }}
            />
            <span className="settings-track"><span className="settings-thumb" /></span>
            <span className="settings-text">
              <strong>Export and print in Analytics</strong>
              <span>
                Shows the &ldquo;Export CSV&rdquo; and &ldquo;Print / Save PDF&rdquo; buttons on the Analytics report.
                Exporting writes real client records to a file on this device, so it is off by default.
              </span>
            </span>
          </label>

          {isShared ? (
            <p className="settings-caveat">
              <strong>This setting is shared across the system.</strong>{' '}
              Turning it on or off applies to every user and every device, and is stored against the
              business rather than in this browser.
              <br /><br />
              It is a switch, not a permission. Row Level Security is not enabled, so the database will
              accept a change from anyone holding the publishable key. It keeps the option out of the way;
              it does not keep it out of reach.
            </p>
          ) : (
            <p className="settings-caveat settings-caveat-warn">
              <strong>Shared storage is not available, so this is saved in this browser only.</strong>{' '}
              It will not follow you to another device and other users will not see the change.
              This is expected until the <code>app_settings</code> table exists.
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h3>{editingId ? 'Edit User' : 'Create New User'}</h3>
        {formError && <p className="modal-error" role="alert" style={{ marginTop: '10px' }}>{formError}</p>}
        <form onSubmit={handleAddUser} className="grid-form" style={{ gap: '15px', marginTop: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Username</label>
            <input
              type="text"
              placeholder="Username"
              value={newUser.username}
              onChange={e => setNewUser({ ...newUser, username: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                style={{ width: '100%' }}
              />
              <button
                type="button"
                className="reveal-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Role</label>
            <select
              value={newUser.role}
              onChange={e => setNewUser({ ...newUser, role: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="user">User</option>
              {isSuperadmin && <option value="admin">Admin</option>}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Linked email <span style={{ opacity: 0.7 }}>(for Auth0 sign-in)</span>
            </label>
            <input
              type="email"
              placeholder="name@company.com"
              value={newUser.email}
              onChange={e => {
                setNewUser({ ...newUser, email: e.target.value });
                if (formError) setFormError('');
              }}
              style={{ width: '100%' }}
              autoComplete="off"
              spellCheck={false}
            />
            <p style={{ margin: '6px 0 0', fontSize: '0.72rem', lineHeight: 1.45, color: 'var(--text-dim)' }}>
              The verified address for Auth0 sign-in. It inherits{' '}
              <strong>this</strong> account&rsquo;s role — never more. Required when Auth0 sign-in is enforced.
            </p>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newUser.auth0Required}
                onChange={e => {
                  setNewUser({ ...newUser, auth0Required: e.target.checked });
                  if (formError) setFormError('');
                }}
                style={{ width: 'auto', margin: 0 }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>Require Auth0 sign-in</span>
            </label>
            <p style={{ margin: '6px 0 0', fontSize: '0.72rem', lineHeight: 1.45, color: 'var(--text-dim)' }}>
              When ticked, the old username and password stop working for this account. On by default
              for new accounts. Leave it unticked until Auth0 has actually signed this person in once.
            </p>
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
              {visibleUsers.map((u) => {
                const status = accountStatus(u, now);
                const administrable = canAdminister(u);
                return (
                  <tr key={u.id}>
                    <td data-label="Username" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {u.username}
                      {u.email && (
                        <span style={{ display: 'block', fontWeight: 400, fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                          {u.email}
                        </span>
                      )}
                    </td>
                    <td data-label="Role">
                      <span className={`badge ${u.role === 'superadmin' ? 'badge-purple' : u.role === 'admin' ? 'badge-info' : ''}`}>
                        {u.role.toUpperCase()}
                      </span>
                      {u.auth0_required === true && (
                        <span
                          className="badge badge-warning"
                          style={{ marginLeft: '6px' }}
                          title="The password path refuses this account; sign-in must go through Auth0."
                        >
                          AUTH0 ONLY
                        </span>
                      )}
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${STATUS_BADGE[status.key] || ''}`}>
                        {status.label.toUpperCase()}
                      </span>
                      {status.key === 'suspended' && (
                        <div className="status-detail">
                          {suspensionRemaining(status, now)}
                          {status.reason ? ` · ${status.reason}` : ''}
                        </div>
                      )}
                      {status.key === 'active' && u.suspended_until && (
                        <div className="status-detail">
                          Previous suspension expired {formatDateTime(u.suspended_until)}
                        </div>
                      )}
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {administrable && (
                          <>
                            {isSuperadmin && (
                              status.key === 'suspended' ? (
                                <button onClick={() => liftSuspension(u)} className="btn-action">
                                  Lift suspension
                                </button>
                              ) : (
                                <button
                                  onClick={() => { setSuspendError(''); setSuspendTarget(u); }}
                                  className="btn-action"
                                  title="Temporarily block sign-in without deactivating the account"
                                >
                                  Suspend
                                </button>
                              )
                            )}
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`btn-action ${u.active ? 'danger' : ''}`}
                              title={u.active ? 'Deactivate Account' : 'Activate Account'}
                            >
                              {u.active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => handleEdit(u)} className="btn-action">
                              Edit
                            </button>
                            <button onClick={() => handleDelete(u)} className="btn-action danger">
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isSuperadmin && (
          <p className="status-note">
            Only a superadmin can suspend accounts. Deactivating an account keeps it off until it is
            reactivated; suspending it lifts by itself.
          </p>
        )}
      </div>

      {suspendTarget && (
        <SuspendDialog
          user={suspendTarget}
          saving={suspendSaving}
          error={suspendError}
          onCancel={() => { setSuspendTarget(null); setSuspendError(''); }}
          onConfirm={applySuspension}
        />
      )}
    </div>
  );
};

export default AccountManager;
