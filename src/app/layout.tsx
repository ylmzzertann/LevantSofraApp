import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Work_Sans } from "next/font/google";
import { StoreProvider } from "@/state/store";
import "./globals.css";

/* Self-hosted at build time by next/font — no request to Google at runtime. */
const display = Bodoni_Moda({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const ui = Work_Sans({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Levant Sofra — Mezze · Fire · Sea",
  description:
    "Eastern-Mediterranean mezze, charcoal grill and clay pot in Kadıköy. Order from your table or have the same menu delivered.",
};

export const viewport: Viewport = {
  themeColor: "#FFF6E5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
