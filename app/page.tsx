import Link from "next/link";
import { Brand } from "@/components/shell";
import { HeadToHeadCard, SummaryCard, TurnoutCard } from "@/components/showcase";
import { IconArrowRight } from "@/components/icons";
import { ThemeToggle } from "@/components/theme";

const STEPS = [
  { n: "1", title: "Get added", body: "Your admin adds your Matric or Registration number. Nobody else can register." },
  { n: "2", title: "Register", body: "Enter your number, confirm your name and level, and choose a password." },
  { n: "3", title: "Vote once", body: "Pick one candidate per position. Your ballot can't be cast twice." },
  { n: "4", title: "See results", body: "Results appear on your dashboard as soon as voting closes." },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
      <header className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Brand />
        <nav className="flex items-center gap-2 text-sm">
          <ThemeToggle className="hidden sm:block" />
          <Link href="/staff/login" className="rounded-full px-3 py-2 font-semibold text-muted transition-colors hover:text-foreground">
            Staff
          </Link>
          <Link href="/login" className="rounded-full bg-card px-4 py-2 font-semibold shadow-sm transition-colors hover:bg-subtle">
            Log in
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:pt-14">
          <div>
            {/* <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              Student union elections
            </p> */}
            <h1 className="mt-6 text-[44px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[60px]">
              Your vote,
              <br />
              <span className="text-primary">counted once.</span>
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
              Register with your Matric or Registration number, choose your candidates, and see the results the moment polls close.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-fg shadow-[0_10px_24px_-12px_var(--primary)] transition-colors hover:bg-primary-hover"
              >
                Register to vote
                <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-card px-6 text-[15px] font-semibold shadow-sm transition-colors hover:bg-subtle"
              >
                I already have an account
              </Link>
            </div>
          </div>

          {/* Overlapping, tilted sample cards. Hidden on phones. */}
          <div aria-hidden="true" className="relative mx-auto hidden h-[500px] w-full max-w-[620px] md:block">
            <div className="absolute left-[2%] top-[70px] z-10 -rotate-[8deg] transition-transform duration-300 hover:z-40 hover:-translate-y-2 hover:rotate-0">
              <div className="animate-float">
                <SummaryCard />
              </div>
            </div>
            <div className="absolute left-[60%] top-0 z-20 rotate-[7deg] transition-transform duration-300 hover:z-40 hover:-translate-y-2 hover:rotate-0">
              <div className="animate-float-slow">
                <TurnoutCard />
              </div>
            </div>
            <div className="absolute left-[31%] top-[120px] z-30 rotate-[2deg] transition-transform duration-300 hover:z-40 hover:-translate-y-2 hover:rotate-0">
              <div className="animate-float-late">
                <HeadToHeadCard />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
          <ol className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="surface p-6">
                <span className="num flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-primary">{s.n}</span>
                <h2 className="mt-4 font-extrabold tracking-tight">{s.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-5 pb-8 text-xs text-muted sm:flex-row sm:justify-between sm:px-8">
        <span>Not on the list? Contact your student affairs admin.</span>
        <ThemeToggle className="sm:hidden" />
        <span>All times in West Africa Time (WAT).</span>
      </footer>
    </div>
  );
}
