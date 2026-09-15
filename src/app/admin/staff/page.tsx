import { formatOrderTime } from "@/config/restaurant";
import { listStaff, recentActivity, requireStaff } from "@/server/staff";
import { StaffManager } from "./StaffManager";
import s from "../admin.module.css";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  signed_in: "signed in",
  signed_out: "signed out",
  staff_created: "added an account",
  staff_enabled: "switched an account on",
  staff_disabled: "switched an account off",
  password_reset: "reset a password",
  dish_86d: "86'd",
  dish_back_on: "put back on",
  dish_created: "added a dish",
  dish_edited: "edited",
  dish_deleted: "deleted a dish",
  category_created: "added a section",
  category_edited: "renamed a section",
  category_hidden: "hid a section",
  category_shown: "showed a section",
  category_deleted: "deleted a section",
  round_rung_in: "rang in",
  status_changed: "moved a ticket",
  order_voided: "voided",
  line_voided: "took a plate off",
  payment_taken: "took a payment at",
  table_settled: "settled",
  refund_recorded: "recorded a refund for",
  table_added: "added",
  table_retired: "retired",
};

function describe(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => {
      if (typeof v === "number" && ["total", "amount", "finalPayment", "owedBefore", "unitPrice", "price"].includes(k)) {
        return `${k}: $${(v / 100).toFixed(2)}`;
      }
      return `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`;
    })
    .join(" · ");
}

export default async function StaffPage() {
  const me = await requireStaff("owner");
  const [people, activity] = await Promise.all([listStaff(), recentActivity(80)]);

  return (
    <div className={s.page}>
      <h1 className={s.heading}>Staff</h1>
      <p className={s.sub}>
        Everyone signs in as themselves, so the activity below says who did what. Switching an
        account off signs that person out everywhere, straight away.
      </p>

      <StaffManager people={people} meId={me.id} />

      <div className={s.card}>
        <h2 className={s.sectionTitle}>Activity</h2>
        {activity.length === 0 ? (
          <p className={s.sub}>Nothing yet.</p>
        ) : (
          <div className={s.activity}>
            {activity.map((a, i) => (
              <div key={i} className={s.activityRow}>
                <span className={s.activityWhen}>{formatOrderTime(new Date(a.at))}</span>
                <span>
                  <strong>{a.who}</strong> {ACTION_LABELS[a.action] ?? a.action.replace(/_/g, " ")}
                  {a.subject ? ` ${a.subject}` : ""}
                  {Object.keys(a.detail).length > 0 && (
                    <div className={s.activityDetail}>{describe(a.detail)}</div>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
