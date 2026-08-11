import { redirect } from "next/navigation";
import { isStaff, usingDefaultPassword } from "@/server/auth";
import { getMenu } from "@/server/menu";
import { DishEditor } from "./DishEditor";
import { DishList } from "./DishList";
import s from "./admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  if (!(await isStaff())) redirect("/admin/login");
  const categories = await getMenu();

  return (
    <div className={s.page}>
      <h1 className={s.heading}>The menu</h1>
      <p className={s.sub}>
        Changes are live immediately. Guests already sitting with the menu open pick them up within
        a minute without reloading — so 86 a dish the moment it runs out.
      </p>

      {usingDefaultPassword && (
        <div className={s.warning}>
          This panel is still on the default development password. Set{" "}
          <code>ADMIN_PASSWORD</code> in <code>.env.local</code> before anyone outside the kitchen
          can reach it.
        </div>
      )}

      <div className={s.card}>
        <h2 className={s.sectionTitle}>Add a dish</h2>
        <DishEditor categories={categories.map((c) => ({ key: c.key, label: c.label }))} />
      </div>

      <DishList categories={categories} />
    </div>
  );
}
