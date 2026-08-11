import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { isStaff, usingDefaultPassword } from "@/server/auth";
import { LoginForm } from "./LoginForm";
import s from "../admin.module.css";

export default async function LoginPage() {
  if (await isStaff()) redirect("/admin");

  return (
    <div className={s.login}>
      <div className={s.loginCard}>
        <Logo size={48} />
        <h1 className={s.heading} style={{ marginTop: 14 }}>
          Back of house
        </h1>
        <p className={s.sub} style={{ margin: "0 0 20px" }}>
          Staff only.
        </p>
        {usingDefaultPassword && (
          <div className={s.warning}>
            No <code>ADMIN_PASSWORD</code> is set, so the development password{" "}
            <strong>levant</strong> is live. Set one before this is reachable from outside.
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  );
}
