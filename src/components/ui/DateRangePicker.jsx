import React, { useMemo } from 'react';
import { buildPresets, describeRange, daysInRange, isAllTime } from '../../lib/dateRange';

/**
 * Shared period control. Replaces the duplicated "show all time / reset to
 * week" pair, which was the only period choice the app offered — too coarse to
 * analyse anything on.
 */
export default function DateRangePicker({ value, onChange, showCustom = true }) {
  const presets = useMemo(() => buildPresets(), []);

  const activeKey = presets.find(
    (p) => p.range.start === value.start && p.range.end === value.end
  )?.key;

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
            className={`rk-preset ${activeKey === preset.key ? 'rk-preset-active' : ''}`}
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