import { ImageResponse } from "next/og";

// Home-screen icon (iOS needs a PNG): the logo mark on the brand green, no text.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0f8a5a" }}>
        <svg width="180" height="180" viewBox="1 1 30 30" fill="none">
          <path d="M11 6.5h10v10H11z" fill="#ffffff" />
          <path d="m13.4 11.6 1.9 1.9 3.4-4" stroke="#0f8a5a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 16.5h19" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 19.5h16v6H8z" fill="#ffffff" opacity="0.3" />
        </svg>
      </div>
    ),
    size,
  );
}
