"use client";

import type { ReactNode } from "react";
import { ColumnChart, Donut, LegendStat } from "@/components/charts";
import { IconArrowLeft, IconCheck, IconX } from "@/components/icons";
import { Avatar } from "@/components/ui";

// Decorative sample cards for the landing page (static data, hidden from assistive tech by the parent).
function PhoneCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`surface w-[214px] shrink-0 p-4 ${className ?? ""}`}>
      <IconArrowLeft size={15} className="text-muted" />
      {children}
    </div>
  );
}

export function SummaryCard() {
  const voters = [
    { n: "Oscar Okon", voted: true },
    { n: "Andrea Ade", voted: true },
    { n: "Stacy Uche", voted: false },
    { n: "Michael Kalu", voted: true },
  ];
  return (
    <PhoneCard>
      <p className="mt-2 text-lg font-extrabold tracking-tight">Summary votes</p>
      <p className="mt-3 text-[11px] font-semibold">Results</p>
      <div className="mt-2 flex items-center justify-between gap-1">
        <LegendStat color="var(--series-track)" label="Not" value={13} />
        <Donut
          segments={[{ key: "v", label: "Voted", value: 68, color: "var(--series-1)" }]}
          total={100}
          size={84}
          thickness={9}
          label="Sample: 68% of students voted"
          center={() => <span className="num text-lg font-extrabold">68%</span>}
        />
        <LegendStat color="var(--series-1)" label="Voted" value={127} align="right" />
      </div>
      <ul className="mt-4 flex flex-col gap-2.5">
        {voters.map((v) => (
          <li key={v.n} className="flex items-center gap-2.5 text-[13px] font-semibold">
            <Avatar name={v.n} size={26} />
            <span className="flex-1 truncate">{v.n}</span>
            <span
              className={`flex size-5 items-center justify-center rounded-full ${v.voted ? "bg-primary text-primary-fg" : "bg-danger-soft text-danger"}`}
              aria-label={v.voted ? "Voted" : "Not voted"}
            >
              {v.voted ? <IconCheck size={11} strokeWidth={3} /> : <IconX size={11} strokeWidth={3} />}
            </span>
          </li>
        ))}
      </ul>
    </PhoneCard>
  );
}

export function HeadToHeadCard() {
  return (
    <PhoneCard>
      <p className="mt-2 text-lg font-extrabold tracking-tight">A or B</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { l: "A", n: "Adaeze", c: "var(--series-1)" },
          { l: "B", n: "Tunde", c: "var(--series-2)" },
        ].map((x) => (
          <div key={x.l} className="flex flex-col items-center gap-2 rounded-2xl bg-subtle px-2 pb-3 pt-4">
            <Avatar name={`${x.n} X`} size={44} />
            <span className="text-xs font-bold">{x.n}</span>
            <span className="flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: x.c }}>
              {x.l}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] font-semibold">Results</p>
      <div className="mt-2 flex items-center justify-between gap-1">
        <LegendStat color="var(--series-1)" label="A" value={38} />
        <Donut
          segments={[
            { key: "b", label: "B", value: 68, color: "var(--series-2)" },
            { key: "a", label: "A", value: 38, color: "var(--series-1)" },
          ]}
          size={92}
          thickness={10}
          label="Sample: B 64%, A 36%"
          center={() => (
            <>
              <span className="text-xs font-bold text-muted">B</span>
              <span className="num text-xl font-extrabold leading-none">64%</span>
            </>
          )}
        />
        <LegendStat color="var(--series-2)" label="B" value={68} align="right" />
      </div>
    </PhoneCard>
  );
}

export function TurnoutCard() {
  return (
    <PhoneCard>
      <p className="mt-2 text-lg font-extrabold tracking-tight">Turnout by level</p>
      <p className="mt-3 text-[11px] font-semibold">Students voted (%)</p>
      <div className="mt-6">
        <ColumnChart
          height={120}
          label="Sample turnout by level"
          data={[
            { key: "100", label: "100L", value: 22 },
            { key: "200", label: "200L", value: 51 },
            { key: "300", label: "300L", value: 28 },
            { key: "400", label: "400L", value: 37 },
          ]}
          max={100}
        />
      </div>
    </PhoneCard>
  );
}

