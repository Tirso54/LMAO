import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LMAO — League of Møøbas | The Amazingly Off-brand MOBA",
  description:
    "Why pay full price for a MOBA? LMAO is a Temu-tier League of Legends knockoff you can actually play online with friends. Host a room, invite the squad, and destroy the enemy Nexus. 90% OFF (fake discount).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ff6a00",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
