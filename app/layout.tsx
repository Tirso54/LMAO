import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";

// Engraved fantasy-roman display face for the wordmark, section titles and
// champion names. Clean humanist sans for everything else.
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lmao-blush.vercel.app"),
  title: "LMAO — League of Møøbas | MOBA de navegador, edición off-brand",
  description:
    "LMAO es un MOBA cinematográfico que se juega directamente en el navegador: gratis, sin cuentas y con multijugador online. Elige campeón, sube de nivel con tus minions, derriba torretas y destruye el Nexo enemigo.",
  keywords: [
    "LMAO",
    "MOBA",
    "navegador",
    "League of Møøbas",
    "multijugador",
    "gratis",
    "sin descarga",
  ],
  authors: [{ name: "LMAO" }],
  openGraph: {
    title: "LMAO — League of Møøbas",
    description:
      "Un MOBA cinematográfico para el navegador. Gratis, sin cuentas, sin descargas. Crea una sala y reparte tortas contra amigos o bots que se esfuerzan demasiado.",
    type: "website",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "LMAO — League of Møøbas",
    description:
      "Un MOBA cinematográfico para el navegador. Gratis, sin cuentas, sin descargas.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#07090d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${cinzel.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
