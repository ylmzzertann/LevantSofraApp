import { redirect } from "next/navigation";

/** The floor is what staff open first. */
export default function AdminHome() {
  redirect("/admin/tables");
}
