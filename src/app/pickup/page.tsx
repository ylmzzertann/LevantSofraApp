import { PickupScreen } from "@/components/screens/PickupScreen";
import { asapReadyAt, formatClock, pickupSlots } from "@/config/restaurant";

export const dynamic = "force-dynamic";

/**
 * Slots are built here rather than in the browser so they follow the
 * restaurant's clock and opening hours, not the guest's device clock.
 */
export default function PickupPage() {
  const now = new Date();
  return <PickupScreen slots={pickupSlots(now)} asapLabel={formatClock(asapReadyAt(now))} />;
}
