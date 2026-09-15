import { and, eq } from "drizzle-orm";
import { EntryScreen } from "@/components/screens/EntryScreen";
import { db, schema } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { verifyTableKey } from "@/server/table-keys";

export const dynamic = "force-dynamic";

/**
 * The QR sticker on each table points here — `/t/12?k=…`. The signature is
 * checked on the server before the guest is told they're seated; the order
 * endpoint checks it again, because a page is not a security boundary.
 */
export default async function TableEntry({
  params,
  searchParams,
}: {
  params: Promise<{ table: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { table: raw } = await params;
  const { k } = await searchParams;
  const table = decodeURIComponent(raw);

  await ensureDb();
  const [row] = await db
    .select({ id: schema.tables.id })
    .from(schema.tables)
    .where(and(eq(schema.tables.id, table), eq(schema.tables.active, true)))
    .limit(1);

  const valid = !!row && verifyTableKey(table, k);
  return <EntryScreen table={table} tableKey={valid ? k! : null} />;
}
