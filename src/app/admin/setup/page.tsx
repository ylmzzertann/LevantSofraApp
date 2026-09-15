import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { setupNeedsToken, staffCount } from "@/server/staff";
import { SetupForm } from "./SetupForm";
import s from "../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * First run: create the owner account. Only reachable while there are no
 * accounts at all, and in production only with the server's SETUP_TOKEN.
 */
export default async function SetupPage() {
  if ((await staffCount()) > 0) redirect("/admin/login");

  return (
    <div className={s.login}>
      <div className={s.loginCard}>
        <Logo size={48} />
        <h1 className={s.heading} style={{ marginTop: 14 }}>
          Set up the restaurant
        </h1>
        <p className={s.sub} style={{ margin: "0 0 20px" }}>
          Create the owner account. You can add everyone else from inside.
        </p>
        <SetupForm needsToken={setupNeedsToken()} />
      </div>
    </div>
  );
}
