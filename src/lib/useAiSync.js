import { useEffect, useRef } from 'react';

/**
 * Refetch when the assistant changes records.
 *
 * aiService has always dispatched 'tracksimply-ai-sync' after every tool call
 * that writes, but no component ever listened for it. An AI-driven change
 * therefore did not appear on screen until the user navigated away and back, or
 * a Supabase realtime event happened to arrive first. On any view without a
 * realtime subscription the change simply never showed.
 *
 * The latest refetch is held in a ref so this subscribes once and still calls
 * the current function — the tool components define their fetch inline, so a
 * dependency on it would resubscribe on every render.
 *
 * Call it with an arrow — useAiSync(() => fetchDebts()) — not the function
 * itself. These components declare their fetch with `const` lower down, so
 * passing the value directly reads it before initialisation and throws
 * "Cannot access 'fetchDebts' before initialization". An arrow defers the read
 * until the event fires, by which point the binding exists.
 */
export function useAiSync(refetch) {
  const latest = useRef(refetch);

  useEffect(() => {
    latest.current = refetch;
  });

  useEffect(() => {
    const handler = () => latest.current?.();
    window.addEventListener('tracksimply-ai-sync', handler);
    return () => window.removeEventListener('tracksimply-ai-sync', handler);
  }, []);
}

export default useAiSync;
