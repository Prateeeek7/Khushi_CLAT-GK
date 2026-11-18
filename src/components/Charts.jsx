// Hand-rolled, dependency-free charts following the dataviz mark specs:
// 2px lines, >=8px markers with a surface ring, <=24px bars with 4px rounded data-ends,
// hairline recessive grid, single-series charts carry no legend, hover + keyboard tooltips.
import { useEffect, useMemo, useRef, useState } from 'react';

function useWidth(ref, fallback = 600) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * Single-series line chart with crosshair tooltip.
 * points: [{ key, label, value, detail }]
 */
export function LineChart({ points, height = 200, min = 0, max = 100, unit = '%', ariaLabel }) {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const [hover, setHover] = useState(null);
  const pad = { l: 36, r: 16, t: 12, b: 24 };
  const lo = Math.min(min, ...points.map((p) => p.value));
  const hi = Math.max(max, ...points.map((p) => p.value));
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const x = (i) => pad.l + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const ticks = useMemo(() => {
    const step = hi - lo > 100 ? 50 : 25;
    const out = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t);
    return out;
  }, [lo, hi]);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = points.length > 1 ? `${path}L${x(points.length - 1)},${y(Math.max(lo, 0))}L${x(0)},${y(Math.max(lo, 0))}Z` : '';

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  }
  function onKey(e) {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? points.length) - 1));
    else return;
    e.preventDefault();
  }
  const hp = hover != null ? points[hover] : null;
  const last = points[points.length - 1];

  return (
    <div className="chart" ref={wrap}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className={`grid ${t === 0 ? 'zero' : ''}`} x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
            <text className="axis" x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {t}
              {unit}
            </text>
          </g>
        ))}
        {area && <path className="area" d={area} />}
        <path className="line" d={path} />
        {hp && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} />}
        {points.map((p, i) =>
          i === points.length - 1 || i === hover ? (
            <circle key={p.key} className="dot" cx={x(i)} cy={y(p.value)} r={i === hover ? 5 : 4} />
          ) : null
        )}
        {last && hover == null && (
          <text className="end-label" x={x(points.length - 1)} y={y(last.value) - 12} textAnchor="end">
            {Math.round(last.value)}
            {unit}
          </text>
        )}
        <text className="axis" x={pad.l} y={height - 6}>
          {points[0]?.label}
        </text>
        {points.length > 1 && (
          <text className="axis" x={width - pad.r} y={height - 6} textAnchor="end">
            {last.label}
          </text>
        )}
      </svg>
      {hp && (
        <div
          className="tooltip"
          style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: Math.max(0, y(hp.value) - 64) }}
          role="status"
        >
          <strong>
            {Math.round(hp.value)}
            {unit}
          </strong>
          <span>{hp.detail || hp.label}</span>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars (single series). rows: [{ key, label, value (0..1|null), meta }] */
export function BarList({ rows, format = (v) => `${Math.round(v * 100)}%`, empty = 'No data yet' }) {
  const [hover, setHover] = useState(null);
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li
          key={r.key}
          className={hover === r.key ? 'hover' : ''}
          onPointerEnter={() => setHover(r.key)}
          onPointerLeave={() => setHover(null)}
          tabIndex={0}
          onFocus={() => setHover(r.key)}
          onBlur={() => setHover(null)}
          aria-label={`${r.label}: ${r.value == null ? empty : format(r.value)}${r.meta ? `, ${r.meta}` : ''}`}
        >
          <span className="bl-label">{r.label}</span>
          <span className="bl-track">
            {r.value != null && <span className="bl-bar" style={{ width: `${Math.max(1.5, r.value * 100)}%` }} />}
          </span>
          <span className="bl-value">{r.value == null ? '—' : format(r.value)}</span>
          {r.meta && <span className="bl-meta">{r.meta}</span>}
        </li>
      ))}
    </ul>
  );
}

/** One whole split into labelled status parts: [{ key, label, value, tone }] */
export function SegmentBar({ parts, height = 10 }) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  return (
    <div className="segbar">
      <div className="segbar-track" style={{ height }}>
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span
              key={p.key}
              className={`seg tone-${p.tone}`}
              style={{ flexGrow: p.value }}
              title={`${p.label}: ${p.value}`}
            />
          ))}
      </div>
      <ul className="segbar-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className={`swatch tone-${p.tone}`} aria-hidden="true" />
            <strong>{p.value}</strong> {p.label}
            <span className="muted"> · {Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tiny trend line for stat tiles. */
export function Sparkline({ values, width = 120, height = 32 }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i) => 2 + (i * (width - 4)) / (values.length - 1);
  const y = (v) => height - 4 - ((v - lo) / (hi - lo || 1)) * (height - 8);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <svg className="spark" width={width} height={height} aria-hidden="true">
      <path d={d} />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" />
    </svg>
  );
}
