import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LMAO — League of Møøbas | MOBA en el navegador",
  description:
    "LMAO es un MOBA jugable directamente en el navegador, gratis y con multijugador online. Controla a tu campeón con controles táctiles estilo Brawl Stars y derriba el Nexo enemigo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080b10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
