"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProfilePictureForm } from "@/components/profile-picture-form";
import { Card } from "@/components/ui";
import { reloadSession } from "@/lib/api/client";

export function ProfilePictureOnboarding() {
  const router = useRouter();
  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 py-4">
      <div>
        <p className="text-xs font-medium text-muted">One last step</p>
        <h1 className="font-display mt-2 text-[34px] leading-[1.1]">Add your photo</h1>
        <p className="mt-3 leading-relaxed text-muted">
          A clear photo of your face is required before you can see the ballot. It appears on your voter card.
        </p>
      </div>
      <Card className="py-8">
        <ProfilePictureForm
          submitLabel="Save and continue"
          onDone={async () => {
            // Refresh so the session cookie no longer says onboarding is required.
            await reloadSession();
            toast.success("Profile picture saved.");
            router.replace("/student");
            router.refresh();
          }}
        />
      </Card>
    </div>
  );
}
