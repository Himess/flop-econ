import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLOP validator & agent economics",
  description:
    "Validator break-even and agent escrow-risk tools for FLOP Network. Every figure carries its bucket (DEFINED / PLANNED / ABSENT) and a citation into the yellow paper.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
