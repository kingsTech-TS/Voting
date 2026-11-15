import type { Metadata } from "next";
import { NewElection } from "./new-election";

export const metadata: Metadata = { title: "New election" };

export default function NewElectionPage() {
  return <NewElection />;
}
