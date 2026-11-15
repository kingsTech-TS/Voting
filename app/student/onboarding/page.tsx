import type { Metadata } from "next";
import { ProfilePictureOnboarding } from "./onboarding";

export const metadata: Metadata = { title: "Add your profile picture" };

export default function StudentOnboardingPage() {
  return <ProfilePictureOnboarding />;
}
