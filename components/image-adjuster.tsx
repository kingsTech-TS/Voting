"use client";

import clsx from "clsx";
import { useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { BlobImage } from "./blob-image";

/** Zoom (1 = photo just covers the frame) and the photo's offset from centre, in frame pixels. */
export interface CropState {
  zoom: number;
  x: number;
  y: number;
}

export const INITIAL_CROP: CropState = { zoom: 1, x: 0, y: 0 };

const FRAME = 280; // on-screen frame size (px)
const MAX_ZOOM = 4;
const OUTPUT = 800; // exported image size (px); the server stores a 400×400 version

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Keep the photo covering the whole frame for a given zoom. */
function clampCrop(c: CropState, natural: { w: number; h: number } | null): CropState {
  if (!natural) return c;
  const zoom = clamp(c.zoom, 1, MAX_ZOOM);
  const scale = (FRAME / Math.min(natural.w, natural.h)) * zoom;
  const maxX = Math.max(0, (natural.w * scale - FRAME) / 2);
  const maxY = Math.max(0, (natural.h * scale - FRAME) / 2);
  return { zoom, x: clamp(c.x, -maxX, maxX), y: clamp(c.y, -maxY, maxY) };
}

/**
 * Square photo framer: drag to reposition, slider / wheel / buttons to zoom, arrow keys to nudge.
 * Controlled: the parent keeps `value` and later calls `cropImage(file, value)`.
 */
export function ImageAdjuster({
  file,
  value,
  onChange,
  round = true,
}: {
  file: File;
  value: CropState;
  onChange: (c: CropState) => void;
  round?: boolean;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; from: CropState } | null>(null);
  const [dragging, setDragging] = useState(false);

  const set = (c: CropState) => onChange(clampCrop(c, natural));
  const scale = natural ? (FRAME / Math.min(natural.w, natural.h)) * value.zoom : 1;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, from: value };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    set({ ...d.from, x: d.from.x + (e.clientX - d.startX), y: d.from.y + (e.clientY - d.startY) });
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    set({ ...value, zoom: value.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 30 : 8;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      set({ ...value, x: value.x + moves[e.key][0], y: value.y + moves[e.key][1] });
    } else if (e.key === "+" || e.key === "=") {
      set({ ...value, zoom: value.zoom * 1.1 });
    } else if (e.key === "-") {
      set({ ...value, zoom: value.zoom / 1.1 });
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        role="application"
        aria-label="Photo position. Drag or use arrow keys to move, plus and minus to zoom."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        onKeyDown={onKey}
        className={clsx(
          "relative touch-none select-none overflow-hidden rounded-2xl bg-subtle outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{ width: FRAME, height: FRAME }}
      >
        <BlobImage
          file={file}
          alt="Photo being adjusted"
          draggable={false}
          onLoad={(e) => {
            const n = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
            setNatural(n);
            onChange(clampCrop(value, n));
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
          style={
            natural
              ? {
                  width: natural.w * scale,
                  height: natural.h * scale,
                  transform: `translate(calc(-50% + ${value.x}px), calc(-50% + ${value.y}px))`,
                }
              : { opacity: 0 }
          }
        />
        {/* guides: rule of thirds + the circle used for avatars */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className={clsx("absolute inset-0 grid grid-cols-3 grid-rows-3 transition-opacity", dragging ? "opacity-100" : "opacity-0")}>
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="border-[0.5px] border-white/50" />
            ))}
          </div>
          {round && (
            <>
              <div className="absolute inset-0" style={{ background: "radial-gradient(circle closest-side, transparent 99%, rgb(0 0 0 / 0.4) 100%)" }} />
              <div className="absolute inset-0 rounded-full ring-2 ring-white/85" />
            </>
          )}
        </div>
      </div>

      <div className="flex w-full max-w-[280px] items-center gap-3">
        <button
          type="button"
          onClick={() => set({ ...value, zoom: value.zoom / 1.2 })}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-lg font-bold text-muted hover:text-foreground"
          aria-label="Zoom out"
        >
          −
        </button>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={value.zoom}
          onChange={(e) => set({ ...value, zoom: Number(e.target.value) })}
          aria-label="Zoom"
          className="h-1.5 flex-1 cursor-pointer accent-[var(--primary)]"
        />
        <button
          type="button"
          onClick={() => set({ ...value, zoom: value.zoom * 1.2 })}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-lg font-bold text-muted hover:text-foreground"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span>Drag to move · scroll or slide to zoom</span>
        <button type="button" className="font-semibold text-primary hover:underline" onClick={() => onChange(INITIAL_CROP)}>
          Reset
        </button>
      </div>
    </div>
  );
}

/** Render the framed area to a square image file, ready to upload. */
export async function cropImage(file: File, crop: CropState): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { width: w, height: h } = bitmap;
  const scale = (FRAME / Math.min(w, h)) * crop.zoom; // frame px per source px
  const size = FRAME / scale; // source px visible in the frame
  const sx = w / 2 - crop.x / scale - size / 2;
  const sy = h / 2 - crop.y / scale - size / 2;

  const out = Math.min(OUTPUT, Math.round(size)) || OUTPUT; // never upscale beyond the source
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out, out);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, out, out);
  bitmap.close();

  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
  if (!blob) throw new Error("Could not prepare the image.");
  const name = file.name.replace(/\.[^.]+$/, "") + (type === "image/png" ? ".png" : ".jpg");
  return new File([blob], name, { type });
}

/** Load an existing photo (e.g. a candidate's current Cloudinary image) so it can be re-framed. */
export async function fileFromUrl(url: string, name = "photo.jpg"): Promise<File> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("Could not load the current photo.");
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}
