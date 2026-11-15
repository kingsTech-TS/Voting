"use client";

import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";

/** False on the first frame, true after — lets marks animate in from zero. */
function useDrawn(): boolean {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return drawn;
}

/** Categorical slots in fixed order (validated in globals.css). Never cycled past 6. */
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];
export const OTHER = "var(--muted)";

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Fold anything past the 6th series into "Other" so no hue is ever generated or reused. */
export function withSeriesColors<T extends { id: string; full_name: string; votes: number }>(items: T[]): Segment[] {
  if (items.length <= SERIES.length) {
    return items.map((c, i) => ({ key: c.id, label: c.full_name, value: c.votes, color: SERIES[i] }));
  }
  const head = items.slice(0, SERIES.length - 1).map((c, i) => ({ key: c.id, label: c.full_name, value: c.votes, color: SERIES[i] }));
  const rest = items.slice(SERIES.length - 1).reduce((n, c) => n + c.votes, 0);
  return [...head, { key: "__other", label: `Others (${items.length - SERIES.length + 1})`, value: rest, color: OTHER }];
}

/**
 * Donut chart: rounded segment ends, a surface gap between segments, neutral track for the rest.
 * Hovering (or focusing) a segment swaps the centre label to that segment — the tooltip layer.
 */
export function Donut({
  segments,
  total,
  size = 180,
  thickness = 18,
  center,
  label,
  active,
  onActive,
}: {
  segments: Segment[];
  /** Denominator; defaults to the sum of segments. A larger total leaves a neutral track (part-of-whole). */
  total?: number;
  size?: number;
  thickness?: number;
  center?: (active: Segment | null) => ReactNode;
  label: string;
  active?: string | null;
  onActive?: (key: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const drawn = useDrawn();
  const current = active !== undefined ? active : hover;
  const setCurrent = (k: string | null) => (onActive ? onActive(k) : setHover(k));

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const sum = segments.reduce((n, s) => n + s.value, 0);
  const denom = Math.max(total ?? sum, sum, 1);
  const visible = segments.filter((s) => s.value > 0);
  // Round caps extend each arc by thickness/2 per side; add 2px of surface on top.
  const gap = visible.length > 1 || denom > sum ? thickness + 3 : 0;

  const lengths = visible.map((s) => (s.value / denom) * c);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  const arcs = visible.map((s, i) => ({
    ...s,
    dash: `${drawn ? Math.max(lengths[i] - gap, 0.001) : 0.001} ${c}`,
    rotate: (starts[i] / c) * 360,
  }));
  const activeSeg = segments.find((s) => s.key === current) ?? null;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--series-track)" strokeWidth={thickness} />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={current === a.key ? thickness + 4 : thickness}
            strokeLinecap="round"
            style={{ strokeDasharray: a.dash }}
            strokeDashoffset={-gap / 2}
            transform={`rotate(${a.rotate} ${size / 2} ${size / 2})`}
            className={clsx("cursor-pointer transition-[stroke-dasharray,stroke-width,opacity] duration-[900ms,200ms,200ms] ease-out", current && current !== a.key && "opacity-40")}
            onMouseEnter={() => setCurrent(a.key)}
            onMouseLeave={() => setCurrent(null)}
          >
            <title>{`${a.label}: ${a.value.toLocaleString()}`}</title>
          </circle>
        ))}
      </svg>
      {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center(activeSeg)}</div>}
    </div>
  );
}

/** Reference-style legend point: coloured dot + small label, big number underneath. */
export function LegendStat({ color, label, value, align = "left" }: { color: string; label: string; value: ReactNode; align?: "left" | "right" }) {
  return (
    <div className={clsx("min-w-0 max-w-[7.5rem]", align === "right" && "text-right")}>
      <p className={clsx("flex items-center gap-1.5 text-xs text-muted", align === "right" && "justify-end")} title={label}>
        <span className="size-2 shrink-0 rounded-full ring-1 ring-border-strong/60" style={{ background: color }} aria-hidden="true" />
        <span className="truncate whitespace-nowrap">{label}</span>
      </p>
      <p className="num mt-0.5 text-xl font-bold">{value}</p>
    </div>
  );
}

/** Vertical rounded columns on a pill track (the reference "Age" chart). */
export function ColumnChart({
  data,
  max,
  height = 140,
  label,
}: {
  data: { key: string; label: string; value: number; color?: string }[];
  max?: number;
  height?: number;
  label: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const top = Math.max(max ?? 0, ...data.map((d) => d.value), 1);
  return (
    <div role="img" aria-label={label}>
      <div className="flex items-end justify-around gap-3" style={{ height }}>
        {data.map((d) => {
          const pct = (d.value / top) * 100;
          return (
            <div
              key={d.key}
              className="relative flex h-full w-full max-w-9 flex-col justify-end rounded-full bg-[var(--series-track)]"
              onMouseEnter={() => setHover(d.key)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === d.key && (
                <span className="num absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-ink-fg">
                  {d.value.toLocaleString()}
                </span>
              )}
              <div
                className="animate-grow w-full rounded-full transition-[height] duration-700 ease-out"
                style={{ height: `${Math.max(pct, d.value > 0 ? 8 : 0)}%`, background: d.color ?? "var(--series-1)" }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-around gap-3">
        {data.map((d) => (
          <span key={d.key} className="w-full max-w-16 truncate text-center text-[11px] text-muted" title={d.label}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
