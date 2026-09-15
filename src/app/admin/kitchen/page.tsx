import { requireStaff } from "@/server/staff";
import { KitchenBoard } from "./KitchenBoard";
import s from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const me = await requireStaff();

  return (
    <div className={s.page}>
      <h1 className={s.heading}>The pass</h1>
      <p className={s.sub}>
        Every open ticket, in the order the food is needed. Exclusions are printed the way the guest
        set them. A ticket struck through in terracotta has been voided — stop cooking it.
      </p>
      <KitchenBoard owner={me.role === "owner"} />
    </div>
  );
}
