"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ProfilePictureForm } from "@/components/profile-picture-form";
import { IconArrowLeft } from "@/components/icons";
import { ThemeToggle } from "@/components/theme";
import { Avatar, Button, Dialog, ErrorState, PageSpinner } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { StudentProfileOut } from "@/lib/api/types";

export function StudentProfile() {
  const [changing, setChanging] = useState(false);
  const { data, error, refetch, isPending } = useQuery({
    queryKey: ["student", "me"],
    queryFn: () => api<StudentProfileOut>("students/me"),
  });

  if (isPending) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/student" className="inline-flex items-center gap-1.5 self-start text-sm text-muted transition-colors hover:text-foreground">
        <IconArrowLeft size={15} /> Dashboard
      </Link>
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between bg-primary-soft px-6 py-3 text-primary">
          <p className="text-xs font-medium text-muted">Voter card</p>
          <p className="num text-[11px] text-muted">{data.id_type === "matric" ? "MATRIC" : "REG"}</p>
        </div>
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <Avatar src={data.profile_picture_url} name={data.full_name} size={112} className="rounded-xl" />
          <div className="min-w-0">
            <h1 className="font-display text-[28px] leading-tight">{data.full_name}</h1>
            <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted">
                  {data.id_type === "matric" ? "Matric no." : "Reg. no."}
                </dt>
                <dd className="num mt-0.5 font-medium">{data.identifier}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">Level</dt>
                <dd className="num mt-0.5 font-medium">{data.level}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3.5">
          <p className="text-xs text-muted">Name or level wrong? Ask your admin to correct it.</p>
          <Button variant="secondary" size="sm" onClick={() => setChanging(true)}>
            Change photo
          </Button>
        </div>
      </section>

      <section className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight">Appearance</h2>
          <p className="mt-0.5 text-sm text-muted">Starts with your device&apos;s theme. Your choice is saved on this device.</p>
        </div>
        <ThemeToggle withLabel />
      </section>

      <Dialog open={changing} onClose={() => setChanging(false)} title="Change profile picture">
        <ProfilePictureForm
          submitLabel="Save picture"
          onDone={() => {
            toast.success("Profile picture updated.");
            setChanging(false);
          }}
        />
      </Dialog>
    </div>
  );
}
