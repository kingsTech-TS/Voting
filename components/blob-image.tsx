"use client";

import { useEffect, useRef, type ImgHTMLAttributes } from "react";

/**
 * <img> for a local File (before upload). The object URL is created and revoked inside the same
 * effect, so every effect run gets its own live URL. Creating it during render (useMemo) and
 * revoking it in a cleanup breaks whenever React re-runs effects — Strict Mode in `next dev`, or
 * React 19 restoring a hidden page — and the image silently fails to load.
 */
export function BlobImage({ file, alt, ...rest }: { file: File; alt: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src">) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={alt} {...rest} />;
}
