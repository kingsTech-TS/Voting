import type { ReactNode } from "react";

/** Re-mounts on navigation, so each page fades up as it arrives. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-page-in flex min-w-0 flex-1 flex-col">{children}</div>;
}
