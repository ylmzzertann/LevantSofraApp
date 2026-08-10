"use client";

import { MenuScreen } from "@/components/screens/MenuScreen";
import { SitePage } from "@/components/site/SitePage";

/**
 * Two shells, one menu. Above 768px this is the web site; below it the phone
 * screens are the design, so the same route renders M2 instead. The switch is
 * pure CSS — no viewport guessing on the server, no layout flash on the client.
 */
export default function Home() {
  return (
    <>
      <div className="ls-mobile-only">
        <MenuScreen />
      </div>
      <div className="ls-desktop-only">
        <SitePage />
      </div>
    </>
  );
}
