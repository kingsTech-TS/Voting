import type { Metadata } from "next";
import { Inbox } from "./inbox";

export const metadata: Metadata = { title: "Messages" };

export default function AdminMessagesPage() {
  return <Inbox />;
}
