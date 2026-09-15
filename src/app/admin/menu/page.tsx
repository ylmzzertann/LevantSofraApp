import { getAdminMenu } from "@/server/menu";
import { requireStaff } from "@/server/staff";
import { CategoryEditor } from "./CategoryEditor";
import { DishEditor } from "./DishEditor";
import { DishList } from "./DishList";
import s from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const me = await requireStaff();
  const categories = await getAdminMenu();
  const owner = me.role === "owner";
  const options = categories.map((c) => ({ key: c.key, label: c.label }));

  return (
    <div className={s.page}>
      <h1 className={s.heading}>The menu</h1>
      <p className={s.sub}>
        Changes are live immediately. Guests already sitting with the menu open pick them up within
        a minute without reloading — so 86 a dish the moment it runs out.
        {!owner && " Changing dishes, prices and sections is for owners; anyone can 86."}
      </p>

      {owner && (
        <>
          <div className={s.card}>
            <h2 className={s.sectionTitle}>Add a dish</h2>
            {options.length ? (
              <DishEditor categories={options} />
            ) : (
              <p className={s.sub}>Add a section first.</p>
            )}
          </div>

          <div className={s.card}>
            <h2 className={s.sectionTitle}>Add a section</h2>
            <CategoryEditor />
          </div>
        </>
      )}

      <DishList categories={categories} owner={owner} />
    </div>
  );
}
