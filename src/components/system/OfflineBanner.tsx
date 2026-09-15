"use client";

import { useEffect, useState } from "react";
import s from "./SystemScreens.module.css";

/**
 * Restaurant wifi drops, and phones walk between it and mobile data. Say so
 * plainly, so a guest doesn't tap Pay three times into a dead connection — and
 * reassure them that the bag is safe, because it lives on the phone.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className={s.offline} role="status">
      You&rsquo;re offline — your bag is saved. Orders will go through once you&rsquo;re back.
    </div>
  );
}
