"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ImagePicker } from "@/components/election";
import { INITIAL_CROP, ImageAdjuster, cropImage, type CropState } from "@/components/image-adjuster";
import { Button } from "@/components/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { StudentProfileOut } from "@/lib/api/types";
import { checkImage } from "@/lib/validation";

/** Upload / replace the student's profile picture: choose a photo, frame it (drag + zoom), then save. */
export function ProfilePictureForm({ onDone, submitLabel = "Upload picture" }: { onDone: (p: StudentProfileOut) => void; submitLabel?: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const choose = (f: File | null | undefined) => {
    if (!f) return;
    const problem = checkImage(f);
    setError(problem);
    if (!problem) {
      setFile(f);
      setCrop(INITIAL_CROP);
    }
  };

  const upload = async () => {
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", await cropImage(file, crop));
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
      {file ? (
        <>
          <ImageAdjuster key={`${file.name}-${file.size}-${file.lastModified}`} file={file} value={crop} onChange={setCrop} round />
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
            Choose a different photo
          </Button>
          {error && (
            <p role="alert" className="text-center text-xs font-medium text-danger">
              {error}
            </p>
          )}
        </>
      ) : (
        <ImagePicker file={null} round error={error} onChange={(f, problem) => (problem ? setError(problem) : choose(f))} />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button size="lg" className="w-full sm:w-auto" onClick={upload} loading={loading} disabled={!file}>
        {submitLabel}
      </Button>
    </div>
  );
}
