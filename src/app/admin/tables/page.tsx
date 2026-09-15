import { getMenu } from "@/server/menu";
import { requireStaff } from "@/server/staff";
import { FloorPlan } from "./FloorPlan";
import s from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function TablesPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const me = await requireStaff();
  const categories = await getMenu();
  const { denied } = await searchParams;

  return (
    <div className={s.page}>
      <h1 className={s.heading}>The floor</h1>
      <p className={s.sub}>
        Every table&rsquo;s running tab — rounds ordered from a phone at the table and rounds you
        ring in here land on the same bill. Take payments as they come, settle when they leave.
      </p>
      {denied && <div className={s.warning}>That page is for owners. Ask an owner to do it.</div>}
      <FloorPlan categories={categories} owner={me.role === "owner"} />
    </div>
  );
}
