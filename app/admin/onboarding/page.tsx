import type { Metadata } from "next";
import { AdminOnboarding } from "./onboarding";

export const metadata: Metadata = { title: "Set up your account" };

export default function AdminOnboardingPage() {
  return <AdminOnboarding />;
}
