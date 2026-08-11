import { redirect } from "next/navigation";
import { isStaff } from "@/server/auth";
import { getMenu } from "@/server/menu";
import { FloorPlan } from "./FloorPlan";
import s from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  if (!(await isStaff())) redirect("/admin/login");
  const categories = await getMenu();

  return (
    <div className={s.page}>
      <h1 className={s.heading}>The floor</h1>
      <p className={s.sub}>
        Every table&rsquo;s running tab — rounds ordered from a phone at the table and rounds you
        ring in here land on the same bill. Settle it when they leave.
      </p>
      <FloorPlan categories={categories} />
    </div>
  );
}
