import { redirect } from "next/navigation";
import { isStaff } from "@/server/auth";
import { KitchenBoard } from "./KitchenBoard";
import s from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  if (!(await isStaff())) redirect("/admin/login");

  return (
    <div className={s.page}>
      <h1 className={s.heading}>The pass</h1>
      <p className={s.sub}>
        Every open ticket, oldest first. Exclusions and notes are printed the way the guest set
        them — a line in terracotta means something was left out on purpose.
      </p>
      <KitchenBoard />
    </div>
  );
}
