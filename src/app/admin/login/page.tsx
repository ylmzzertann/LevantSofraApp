import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { DEV_OWNER, currentStaff, staffCount } from "@/server/staff";
import { LoginForm } from "./LoginForm";
import s from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  if (await currentStaff()) redirect("/admin/tables");
  // A brand-new production deployment has nobody to sign in as yet.
  if ((await staffCount()) === 0) redirect("/admin/setup");

  const { created } = await searchParams;
  const development = process.env.NODE_ENV !== "production";

  return (
    <div className={s.login}>
      <div className={s.loginCard}>
        <Logo size={48} />
        <h1 className={s.heading} style={{ marginTop: 14 }}>
          Back of house
        </h1>
        <p className={s.sub} style={{ margin: "0 0 20px" }}>
          Sign in with your own account.
        </p>

        {created && <div className={s.notice}>Owner account created. Sign in to carry on.</div>}

        {development && (
          <div className={s.devCreds}>
            Development only — this account doesn&rsquo;t exist in production:
            <br />
            <code>{DEV_OWNER.email}</code> / <code>{DEV_OWNER.password}</code>
          </div>
        )}

        <LoginForm />
      </div>
    </div>
  );
}
