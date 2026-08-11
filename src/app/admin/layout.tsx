import type { Metadata } from "next";
import Link from "next/link";
import { RESTAURANT } from "@/config/restaurant";
import { isStaff } from "@/server/auth";
import { signOut } from "@/server/admin-actions";
import s from "./admin.module.css";

export const metadata: Metadata = {
  title: `Back of house — ${RESTAURANT.name}`,
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await isStaff();

  return (
    <div className={s.shell}>
      {staff && (
        <div className={s.bar}>
          <span className={s.barTitle}>{RESTAURANT.name}</span>
          <nav className={s.barLinks}>
            <Link href="/admin/tables" className={s.barLink}>
              Floor
            </Link>
            <Link href="/admin/kitchen" className={s.barLink}>
              Kitchen
            </Link>
            <Link href="/admin" className={s.barLink}>
              Menu
            </Link>
            <Link href="/" className={s.barLink}>
              View site
            </Link>
            <form action={signOut}>
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
