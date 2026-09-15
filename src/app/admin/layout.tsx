import type { Metadata } from "next";
import Link from "next/link";
import { RESTAURANT } from "@/config/restaurant";
import { signOutAction } from "@/server/admin-actions";
import { currentStaff } from "@/server/staff";
import s from "./admin.module.css";

export const metadata: Metadata = {
  title: `Back of house — ${RESTAURANT.name}`,
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await currentStaff();

  return (
    <div className={s.shell}>
      {me && (
        <div className={`${s.bar} ${s.noPrint}`}>
          <span className={s.barTitle}>{RESTAURANT.name}</span>
          <span className={s.barWho}>
            <strong>{me.name}</strong>
            {me.role === "owner" && <span className={s.barRole}>Owner</span>}
          </span>
          <nav className={s.barLinks}>
            <Link href="/admin/tables" className={s.barLink}>
              Floor
            </Link>
            <Link href="/admin/kitchen" className={s.barLink}>
              Kitchen
            </Link>
            <Link href="/admin/menu" className={s.barLink}>
              Menu
            </Link>
            {me.role === "owner" && (
              <>
                <Link href="/admin/qr" className={s.barLink}>
                  Tables &amp; QR
                </Link>
                <Link href="/admin/staff" className={s.barLink}>
                  Staff
                </Link>
              </>
            )}
            <form action={signOutAction}>
              <button type="submit" className={s.barLink}>
                Sign out
              </button>
            </form>
          </nav>
        </div>
      )}
      {children}
    </div>
  );
}
