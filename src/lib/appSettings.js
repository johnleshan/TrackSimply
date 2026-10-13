/**
 * Application preferences.
 *
 * Stored in the `app_settings` table so a change applies to every user and
 * every device, with localStorage used as an instant cache and as the fallback
 * when the table is not reachable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS DOES AND DOES NOT DO.
 *
 * It makes the setting SHARED. A superadmin turning it off hides the report
 * actions for everyone, on every device, consistently. That is the point.
 *
 * It does NOT make it SECURE. Row Level Security is not enabled, so the
 * publishable key in the browser bundle can write to app_settings directly.
 * Anyone determined enough can flip the value with developer tools or a single
 * HTTP request. Treat this as a switch that keeps an option out of the way, not
 * as a permission system. Real enforcement requires RLS plus a real auth token,
 * which this app does not have yet.
 *
 * Export and print are OFF by default: they write real client records to a file
 * on disk, which should not happen as a side effect of opening a report.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const STORAGE_KEY = 'tracksimply_settings';
const TABLE = 'app_settings';

const DEFAULTS = {
  reportActionsEnabled: false,
};

let cache = { ...DEFAULTS };
let shared = false;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn({ ...cache }, shared));
}

function readLocal() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocal(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Non-fatal: the shared copy is the one that matters.
  }
}

/**
 * Reads the shared settings once per session. Safe to call before the table
 * exists: a missing table leaves `shared` false and the local copy in charge.
 */
export async function loadSettings() {
  cache = { ...DEFAULTS, ...readLocal() };
  notify();

  try {
    const { data, error } = await supabase.from(TABLE).select('key, value');
    if (error) {
      shared = false;
      notify();
      return cache;
    }
    const remote = {};
    for (const row of data || []) remote[row.key] = row.value;
    // Shared values win over the local cache.
    cache = { ...DEFAULTS, ...cache, ...remote };
    shared = true;
  } catch {
    shared = false;
  }

  notify();
  return cache;
}

export async function setSetting(key, value) {
  // Update locally first so the switch responds immediately.
  cache = { ...cache, [key]: value };
  writeLocal(cache);
  notify();

  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    shared = !error;
  } catch {
    shared = false;
  }

  notify();
  return shared;
}

export function getSettings() {
  return { ...cache };
}

export function isShared() {
  return shared;
}

/** Subscribes to changes, including ones made in another tab. */
export function useAppSettings() {
  const [settings, setSettings] = useState(() => ({ ...cache }));
  const [isSharedStorage, setIsShared] = useState(shared);

  useEffect(() => {
    const onChange = (next, sharedNow) => {
      setSettings(next);
      setIsShared(sharedNow);
    };
    listeners.add(onChange);

    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      cache = { ...cache, ...readLocal() };
      notify();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      listeners.delete(onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { settings, setSetting, isShared: isSharedStorage };
}
