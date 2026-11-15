"use client";

import { useCountdown } from "./election";

/**
 * Shown after a student has voted while polls are still open: an hourglass that drains and flips,
 * inside a ring that fills with the share of the voting window that has passed (full = results).
 */
export function ResultsWaitScene({ startsAt, endsAt, onDone, size = 220 }: { startsAt: string; endsAt: string; onDone?: () => void; size?: number }) {
  const remaining = useCountdown(endsAt, onDone);
  const total = Math.max(new Date(endsAt).getTime() - new Date(startsAt).getTime(), 1);
  const progress = Math.min(1, Math.max(0, 1 - remaining / total));

  const stroke = 10;
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const angle = progress * 2 * Math.PI - Math.PI / 2;
  const dot = { x: size / 2 + r * Math.cos(angle), y: size / 2 + r * Math.sin(angle) };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${Math.round(progress * 100)} percent of the voting time has passed`}
        className="absolute inset-0"
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--series-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(progress * c, 0.001)} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dasharray] duration-1000 ease-linear"
        />
        {progress > 0.01 && progress < 1 && (
          <g>
            <circle className="hg-glow" cx={dot.x} cy={dot.y} r={9} fill="var(--primary)" />
            <circle cx={dot.x} cy={dot.y} r={6} fill="var(--card)" stroke="var(--primary)" strokeWidth={3} />
          </g>
        )}
      </svg>

      {/* hourglass */}
      <svg
        viewBox="0 0 100 140"
        width={size * 0.42}
        height={size * 0.42 * 1.4}
        aria-hidden="true"
        className="hg-scene absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
      >
        <g className="hg-glass">
          <path
            d="M28 16 C28 48 45 58 45 70 C45 82 28 92 28 124 L72 124 C72 92 55 82 55 70 C55 58 72 48 72 16 Z"
            fill="var(--subtle)"
            stroke="var(--border-strong)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path className="hg-top" d="M33 30 L67 30 C65 45 55 55 50 64 C45 55 35 45 33 30 Z" fill="var(--series-2)" />
          <path className="hg-bottom" d="M31 120 L69 120 C67 106 58 99 50 97 C42 99 33 106 31 120 Z" fill="var(--series-2)" />
          <line className="hg-stream" x1="50" y1="64" x2="50" y2="104" stroke="var(--series-2)" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="16" y="6" width="68" height="11" rx="5.5" fill="var(--primary)" />
          <rect x="16" y="123" width="68" height="11" rx="5.5" fill="var(--primary)" />
        </g>
      </svg>
    </div>
  );
}
