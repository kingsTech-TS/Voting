"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ImagePicker } from "@/components/election";
import { Button } from "@/components/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { StudentProfileOut } from "@/lib/api/types";

/** Upload / replace the student's profile picture. */
export function ProfilePictureForm({ onDone, submitLabel = "Upload picture" }: { onDone: (p: StudentProfileOut) => void; submitLabel?: string }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const upload = async () => {
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const profile = await api<StudentProfileOut>("students/me/profile-picture", { method: "PUT", form });
      queryClient.setQueryData(["student", "me"], profile);
      setFile(null);
      onDone(profile);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <ImagePicker
        file={file}
        round
        error={error}
        onChange={(f, problem) => {
          setFile(f);
          setError(problem);
        }}
      />
      <Button size="lg" className="w-full sm:w-auto" onClick={upload} loading={loading} disabled={!file}>
        {submitLabel}
      </Button>
    </div>
  );
}
