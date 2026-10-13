import React, { useMemo } from 'react';
import { buildPresets, describeRange, daysInRange, isAllTime } from '../../lib/dateRange';

/**
 * Shared period control. Replaces the duplicated "show all time / reset to
 * week" pair, which was the only period choice the app offered — too coarse to
 * analyse anything on.
 *
 * `activePresetKey` exists because Analytics resolves the All Time sentinel to
 * the span the data actually covers. It passes that resolved range in as
 * `value` so the dates and day count are truthful, while this prop keeps the
 * All Time button highlighted.
 */
export default function DateRangePicker({ value, onChange, showCustom = true, activePresetKey }) {
  const presets = useMemo(() => buildPresets(), []);

  const derivedKey = presets.find(
    (p) => p.range.start === value.start && p.range.end === value.end
  )?.key;

  const highlighted = activePresetKey ?? derivedKey;

  const apply = (range) => onChange({ ...range });

  const setCustom = (edge) => (event) => {
    const next = { ...value, [edge]: event.target.value };
    if (next.start > next.end) {
      // Keep the window valid whichever end the user just touched.
      if (edge === 'start') next.end = next.start;
      else next.start = next.end;
    }
    onChange(next);
  };

  const days = daysInRange(value);

  return (
    <div className="rk-daterange">
      <div className="rk-presets">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`rk-preset ${highlighted === preset.key ? 'rk-preset-active' : ''}`}
            onClick={() => apply(preset.range)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="rk-custom">
          <label>
            From{' '}
            <input type="date" value={value.start} onChange={setCustom('start')} max={value.end} />
          </label>
          <label>
            To{' '}
            <input type="date" value={value.end} onChange={setCustom('end')} min={value.start} />
          </label>
          <span>
            {describeRange(value)} · {days} day{days === 1 ? '' : 's'}
            {isAllTime(value) && ' · full history'}
          </span>
        </div>
      )}
    </div>
  );
}