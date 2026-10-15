import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EVENT } from "@/lib/config";

export const metadata: Metadata = {
  title: `${EVENT.judul} ${EVENT.periode}`,
  description: `Pemungutan suara ${EVENT.judul} periode ${EVENT.periode}`,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#7A1F2B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
