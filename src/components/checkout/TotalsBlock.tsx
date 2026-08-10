import type { TotalRow } from "@/lib/totals";
import s from "@/components/screens/Checkout.module.css";

/**
 * The rows shown must sum exactly to the grand total beneath them — which is
 * why the bag screen's total is tip-free and the tip only appears on payment.
 */
export function TotalsBlock({
  rows,
  grandLabel,
  grandValue,
}: {
  rows: TotalRow[];
  grandLabel: string;
  grandValue: string;
}) {
  return (
    <div className={s.totals}>
      {rows.map((r) => (
        <div key={r.label} className={s.totalRow}>
          <span className={s.totalLabel}>{r.label}</span>
          <span className={s.totalValue} data-positive={!!r.positive}>
            {r.value}
          </span>
        </div>
      ))}
      <div className={s.grandRow}>
        <span className={s.grandLabel}>{grandLabel}</span>
        <span className={s.grandValue}>{grandValue}</span>
      </div>
    </div>
  );
}
