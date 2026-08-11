import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Work_Sans } from "next/font/google";
import { RESTAURANT } from "@/config/restaurant";
import { getMenu } from "@/server/menu";
import { MenuProvider } from "@/state/menu";
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
  title: `${RESTAURANT.name} — ${RESTAURANT.eyebrow}`,
  description:
    "Eastern-Mediterranean mezze, charcoal grill and clay pot in Miami. Order from your table or have the same menu delivered.",
};

/* The menu is live data — a dish can go off mid-service — so pages render per
   request and the caching happens around the query, not around the build. */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#FFF6E5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetched once on the server so the first paint already has the menu, then
  // kept current client-side by MenuProvider.
  const categories = await getMenu();

  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <MenuProvider initial={categories}>
          <StoreProvider>{children}</StoreProvider>
        </MenuProvider>
      </body>
    </html>
  );
}
