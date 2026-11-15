import { StudentShell } from "@/components/shell";

export default function StudentLayout({ children }: LayoutProps<"/student">) {
  return <StudentShell>{children}</StudentShell>;
}
