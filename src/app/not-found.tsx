import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import s from "@/components/system/SystemScreens.module.css";

export default function NotFound() {
  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <Logo size={48} />
        <h1 className={s.title}>That isn&rsquo;t on the menu</h1>
        <p className={s.body}>
          The page may have moved, or the dish has been taken off. Everything we&rsquo;re serving
          today is on the menu.
        </p>
        <div className={s.actions}>
          <Link href="/" className={`${s.btn} ${s.btnPrimary}`}>
            See the menu
          </Link>
        </div>
      </div>
    </div>
  );
}
