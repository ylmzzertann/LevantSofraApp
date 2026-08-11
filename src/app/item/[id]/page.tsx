import { notFound } from "next/navigation";
import { ItemScreen } from "@/components/screens/ItemScreen";
import { getMenu } from "@/server/menu";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const categories = await getMenu();
  const dish = categories.flatMap((c) => c.items).find((d) => d.id === id);
  if (!dish) notFound();
  return <ItemScreen dish={dish} />;
}
