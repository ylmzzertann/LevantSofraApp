import { DoneScreen } from "@/components/screens/DoneScreen";

export const dynamic = "force-dynamic";

export default async function DonePage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;
  return <DoneScreen orderRef={o ?? null} />;
}
