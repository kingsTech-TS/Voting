/**
 * Looping illustration for the "no election yet" dashboard: ballots drift down and drop into a
 * ballot box, which gives a small bounce as each one lands. Pure SVG + CSS (see .bb-* in
 * globals.css); under prefers-reduced-motion it renders as a still image.
 */
export function BallotBoxScene({ size = 240 }: { size?: number }) {
  const ballots = [
    { x: "-26px" },
    { x: "22px" },
    { x: "-8px" },
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      role="img"
      aria-label="Illustration: ballots dropping into a ballot box"
      className="bb-scene overflow-visible"
    >
      <defs>
        {/* Everything above the slot line is visible; ballots vanish as they pass into the box. */}
        <clipPath id="bb-above-slot">
          <rect x="0" y="-80" width="240" height="196" />
        </clipPath>
      </defs>

      {/* soft halo */}
      <circle cx="120" cy="132" r="96" fill="var(--primary-soft)" />
      <g className="bb-orbit">
        <circle cx="120" cy="36" r="4" fill="var(--series-2)" />
        <circle cx="210" cy="150" r="3" fill="var(--series-3)" />
        <circle cx="34" cy="168" r="3.5" fill="var(--series-4)" />
      </g>

      {/* ground shadow */}
      <ellipse className="bb-shadow" cx="120" cy="214" rx="66" ry="7" fill="var(--series-track)" />

      {/* ballots */}
      <g clipPath="url(#bb-above-slot)">
        {ballots.map((b, i) => (
          <g key={i} className="bb-ballot" style={{ ["--bb-x" as string]: b.x }}>
            <rect x="101" y="56" width="38" height="48" rx="6" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="1.5" />
            <rect x="108" y="64" width="16" height="3" rx="1.5" fill="var(--border-strong)" />
            <rect x="108" y="71" width="24" height="3" rx="1.5" fill="var(--border)" />
            <circle cx="120" cy="88" r="8" fill="var(--primary)" />
            <path d="m116.2 88 2.6 2.6 5-5.2" stroke="var(--primary-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </g>

      {/* ballot box */}
      <g className="bb-box">
        <rect x="52" y="118" width="136" height="94" rx="20" fill="var(--primary)" />
        <rect x="40" y="104" width="160" height="24" rx="12" fill="var(--primary)" />
        <rect x="40" y="104" width="160" height="24" rx="12" fill="#000" opacity="0.12" />
        <rect x="82" y="112" width="76" height="7" rx="3.5" fill="#000" opacity="0.35" />
        <rect x="92" y="148" width="56" height="36" rx="10" fill="#fff" opacity="0.18" />
        <path d="m109 166 7 7 15-15" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      </g>

      {/* sparkles */}
      {[
        { x: 44, y: 70, s: 1 },
        { x: 196, y: 84, s: 0.8 },
        { x: 178, y: 30, s: 0.6 },
        { x: 60, y: 22, s: 0.7 },
      ].map((p, i) => (
        <path
          key={i}
          className="bb-sparkle"
          d={`M${p.x} ${p.y - 8 * p.s}L${p.x + 2.2 * p.s} ${p.y - 2.2 * p.s}L${p.x + 8 * p.s} ${p.y}L${p.x + 2.2 * p.s} ${p.y + 2.2 * p.s}L${p.x} ${p.y + 8 * p.s}L${p.x - 2.2 * p.s} ${p.y + 2.2 * p.s}L${p.x - 8 * p.s} ${p.y}L${p.x - 2.2 * p.s} ${p.y - 2.2 * p.s}Z`}
          fill="var(--series-2)"
        />
      ))}
    </svg>
  );
}
