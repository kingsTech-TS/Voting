import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/components/theme-script";
import { Providers } from "./providers";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-app-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = Geist_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Campus Voting", template: "%s · Campus Voting" },
  description: "Student elections: register with your Matric or Registration number, vote once, see the results when polls close.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1411" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set before paint by the inline script, so React must not warn about it.
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
