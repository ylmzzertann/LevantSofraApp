import { notFound } from "next/navigation";
import { ItemScreen } from "@/components/screens/ItemScreen";
import { CATEGORIES, getDish } from "@/data/menu";

export function generateStaticParams() {
  return CATEGORIES.flatMap((c) => c.items).map((d) => ({ id: d.id }));
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dish = getDish(id);
  if (!dish) notFound();
  return <ItemScreen dish={dish} />;
}
