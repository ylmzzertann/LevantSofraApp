import { EntryScreen } from "@/components/screens/EntryScreen";

/**
 * The QR sticker on each table points here — `/t/12`. The table number arrives
 * in the URL, so the mode is detected rather than chosen.
 *
 * When the backend lands this page should POST /sessions/qr with the scanned
 * code and take `{ tableId, tableLabel }` from the response instead of trusting
 * the path segment.
 */
export default async function TableEntry({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  return <EntryScreen table={decodeURIComponent(table)} />;
}
