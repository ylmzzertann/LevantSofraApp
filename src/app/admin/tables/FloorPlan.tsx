"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category } from "@/data/menu";
import { exclusionLine } from "@/lib/bag";
import { money } from "@/lib/money";
import type { TabRound, TableTab } from "@/server/tables";
import s from "../admin.module.css";

const POLL_MS = 6000;
type Method = "cash" | "card" | "other";

export function FloorPlan({ categories, owner }: { categories: Category[]; owner: boolean }) {
  const [tables, setTables] = useState<TableTab[] | null>(null);
  const [openTable, setOpenTable] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tables", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { tables: TableTab[] };
      setTables(data.tables ?? []);
    } catch {
      // Keep the floor on screen rather than blanking it.
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const selected = tables?.find((t) => t.tableId === openTable) ?? null;

  const act = async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) setError(data.error ?? "That didn't go through.");
      await load();
      return !!data.ok;
    } catch {
      setError("Couldn't reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (tables === null) return <p className={s.emptyBoard}>Loading the floor…</p>;

  const seated = tables.filter((t) => t.sessionId);

  return (
    <>
      <div className={s.floorSummary}>
        <span>
          <strong>{seated.length}</strong> of {tables.length} tables seated
        </span>
        <span>
          Still owed on tabs: <strong>{money(seated.reduce((a, t) => a + t.outstanding, 0))}</strong>
        </span>
      </div>

      {error && <div className={s.warning}>{error}</div>}

      <div className={s.floor}>
        {tables.map((t) => (
          <button
            key={t.tableId}
            type="button"
            className={s.tableCard}
            data-seated={!!t.sessionId}
            data-selected={openTable === t.tableId}
            onClick={() => {
              setError(null);
              setOpenTable(openTable === t.tableId ? null : t.tableId);
            }}
          >
            <span className={s.tableLabel}>{t.label}</span>
            {t.sessionId ? (
              <>
                <span className={s.tableTotal}>{money(t.total)}</span>
                <span className={s.tableMeta}>
                  {t.overpaid > 0
                    ? `${money(t.overpaid)} to give back`
                    : t.outstanding > 0
                      ? `${money(t.outstanding)} owed`
                      : "Nothing owed"}
                  {t.refundsDue > 0 ? " · refund due" : ""}
                </span>
              </>
            ) : (
              <span className={s.tableFree}>Free</span>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <TableDetail
          key={selected.tableId}
          tab={selected}
          categories={categories}
          owner={owner}
          busy={busy}
          act={act}
          onClosed={() => setOpenTable(null)}
        />
      )}
    </>
  );
}

function TableDetail({
  tab,
  categories,
  owner,
  busy,
  act,
  onClosed,
}: {
  tab: TableTab;
  categories: Category[];
  owner: boolean;
  busy: boolean;
  act: (body: Record<string, unknown>) => Promise<boolean>;
  onClosed: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("card");
  const [note, setNote] = useState("");

  const cents = Math.round(Number.parseFloat(amount) * 100);
  const amountValid = Number.isFinite(cents) && cents > 0 && cents <= tab.outstanding;

  const askReason = (question: string): string | null => {
    const reason = prompt(question);
    if (reason === null) return null;
    return reason.trim();
  };

  const voidRound = (round: TabRound) => {
    const reason = askReason(
      round.paymentStatus === "paid"
        ? `Void ${round.orderNo}? The guest paid ${money(round.total)} on their phone — it will need refunding. Reason:`
        : `Void the whole of ${round.orderNo} (${money(round.total)})? Reason:`,
    );
    if (reason !== null) void act({ action: "voidRound", orderNo: round.orderNo, reason });
  };

  const voidOne = (lineId: string, name: string) => {
    const reason = askReason(`Take one ${name} off the bill? Reason:`);
    if (reason !== null) void act({ action: "voidLine", lineId, qty: 1, reason });
  };

  return (
    <div className={s.card}>
      <div className={s.tabHead}>
        <h2 className={s.sectionTitle} style={{ margin: 0 }}>
          {tab.label}
        </h2>
        <div className={s.tabTotals}>
          <span>
            Total <strong>{money(tab.total)}</strong>
          </span>
          {tab.paidByGuests > 0 && (
            <span>
              Paid on phones <strong>{money(tab.paidByGuests)}</strong>
            </span>
          )}
          {tab.paidAtTable > 0 && (
            <span>
              Taken here <strong>{money(tab.paidAtTable)}</strong>
            </span>
          )}
          <span>
            Owed <strong>{money(tab.outstanding)}</strong>
          </span>
        </div>
      </div>

      {tab.overpaid > 0 && (
        <div className={s.warning}>
          This table has paid {money(tab.overpaid)} more than it now owes — a round was voided after
          it was paid for. Hand it back, then record it here.
          <div className={s.formFooter} style={{ marginTop: 10 }}>
            <button
              type="button"
              className={s.btn}
              disabled={busy}
              onClick={() => {
                if (confirm(`Record ${money(tab.overpaid)} given back by ${method}?`)) {
                  void act({ action: "giveBack", tableId: tab.tableId, method });
                }
              }}
            >
              Record {money(tab.overpaid)} given back by {method}
            </button>
          </div>
        </div>
      )}

      {tab.refundsDue > 0 && (
        <div className={s.warning}>
          {money(tab.refundsDue)} was paid on a phone for a round that&rsquo;s since been voided.
          Refund it through the card provider, then mark it refunded below.
        </div>
      )}

      {tab.rounds.length === 0 ? (
        <p className={s.sub}>Nothing ordered yet. Ring the first round in below.</p>
      ) : (
        <>
          {tab.items.length > 0 && (
            <div className={s.rollup}>
              {tab.items.map((i) => (
                <span key={i.name} className={s.rollupItem}>
                  {i.qty}× {i.name}
                </span>
              ))}
            </div>
          )}

          {tab.rounds.map((round) => {
            const onTab = round.paymentStatus === "on_tab";
            return (
              <div key={round.orderNo} className={s.round} data-voided={round.voided}>
                <div className={s.roundHead}>
                  <span className={s.roundNo}>{round.orderNo}</span>
                  <span className={s.roundBadge} data-channel={round.channel}>
                    {round.channel === "staff" ? "Rung in" : "From the table"}
                  </span>
                  {round.voided ? (
                    <span className={s.roundBadge} data-state="voided">
                      Voided
                    </span>
                  ) : null}
                  <span className={s.roundBadge} data-payment={round.paymentStatus}>
                    {paymentLabel(round.paymentStatus)}
                  </span>
                  <span className={s.roundTotal}>{money(round.total)}</span>
                </div>

                {round.lines.map((l) => (
                  <div key={l.lineId} className={s.roundLine}>
                    <div className={s.lineRow}>
                      <span className={l.qty === 0 ? s.struck : ""}>
                        {l.qty === 0 ? l.voidedQty : l.qty}× {l.name}
                        {l.voidedQty > 0 && l.qty > 0 ? `  (${l.voidedQty} taken off)` : ""}
                      </span>
                      {!round.voided && onTab && l.qty > 0 && (
                        <button
                          type="button"
                          className={s.linkBtn}
                          disabled={busy}
                          onClick={() => voidOne(l.lineId, l.name)}
                        >
                          −1
                        </button>
                      )}
                    </div>
                    {l.exclusions.length > 0 && (
                      <span className={s.ticketExcl}>{exclusionLine(l.exclusions)}</span>
                    )}
                    {l.note && <span className={s.ticketNote}>&ldquo;{l.note}&rdquo;</span>}
                  </div>
                ))}

                {round.voided && (
                  <div className={s.voidNote}>
                    Voided{round.voidedBy ? ` by ${round.voidedBy}` : ""}
                    {round.voidReason ? ` — ${round.voidReason}` : ""}
                  </div>
                )}

                <div className={s.actions} style={{ marginTop: 6 }}>
                  {!round.voided && (onTab || owner) && (
                    <button type="button" className={s.linkBtn} disabled={busy} onClick={() => voidRound(round)}>
                      Void round
                    </button>
                  )}
                  {round.paymentStatus === "refund_due" && owner && (
                    <button
                      type="button"
                      className={s.linkBtn}
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Record that ${money(round.total)} has been refunded?`)) {
                          void act({ action: "refunded", orderNo: round.orderNo });
                        }
                      }}
                    >
                      Mark refunded
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab.payments.length > 0 && (
        <div className={s.paymentsList}>
          {tab.payments.map((p, i) => (
            <div key={i}>
              {money(p.amount)} by {p.method}
              {p.note ? ` — ${p.note}` : ""}
            </div>
          ))}
        </div>
      )}

      <RingIn
        categories={categories}
        disabled={busy}
        onSend={(lines) => act({ action: "order", tableId: tab.tableId, lines })}
      />

      {tab.sessionId && (
        <>
          {(tab.outstanding > 0 || tab.overpaid > 0) && (
            <div className={s.payPanel}>
              {tab.outstanding > 0 && (
                <div className={s.payField}>
                  <label className="ls-label" htmlFor="pay-amount">
                    Take a payment
                  </label>
                  <input
                    id="pay-amount"
                    className={s.input}
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(tab.outstanding / 100).toFixed(2)}
                    placeholder={(tab.outstanding / 100).toFixed(2)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              )}
              {/* Shared by taking a payment, settling and giving money back. */}
              <div className={s.payField}>
                <label className="ls-label" htmlFor="pay-method">
                  By
                </label>
                <select
                  id="pay-method"
                  className={s.select}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as Method)}
                >
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {tab.outstanding > 0 && (
                <>
                  <div className={s.payField} style={{ flex: 1 }}>
                    <label className="ls-label" htmlFor="pay-note">
                      Note
                    </label>
                    <input
                      id="pay-note"
                      className={s.input}
                      placeholder="Seat 2's share"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={s.btn}
                    disabled={busy || !amountValid}
                    onClick={async () => {
                      const ok = await act({ action: "pay", tableId: tab.tableId, amount: cents, method, note });
                      if (ok) {
                        setAmount("");
                        setNote("");
                      }
                    }}
                  >
                    {amountValid ? `Take ${money(cents)}` : "Take payment"}
                  </button>
                </>
              )}
            </div>
          )}

          <div className={s.formFooter} style={{ marginTop: 18 }}>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              disabled={busy || tab.refundsDue > 0 || tab.overpaid > 0}
              onClick={async () => {
                const question =
                  tab.outstanding > 0
                    ? `Take the remaining ${money(tab.outstanding)} by ${method} and close ${tab.label}?`
                    : `Close ${tab.label}? Nothing is owed.`;
                if (!confirm(question)) return;
                if (await act({ action: "settle", tableId: tab.tableId, method })) onClosed();
              }}
            >
              {tab.outstanding > 0
                ? `Settle ${money(tab.outstanding)} by ${method} and free the table`
                : "Free the table"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function paymentLabel(status: string): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "on_tab":
      return "On the tab";
    case "refund_due":
      return "Refund due";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
}

interface Draft {
  dishId: string;
  name: string;
  qty: number;
}

/** Ringing a round in from a restaurant device — the waiter's side of the app. */
function RingIn({
  categories,
  disabled,
  onSend,
}: {
  categories: Category[];
  disabled: boolean;
  onSend: (lines: { dishId: string; qty: number; exclusions: string[]; note: string }[]) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft[]>([]);
  const [note, setNote] = useState("");

  const dishes = useMemo(
    () => categories.flatMap((c) => c.items).filter((d) => d.available),
    [categories],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return dishes.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 8);
  }, [dishes, query]);

  const addDish = (dishId: string, name: string) => {
    setDraft((prev) => {
      const found = prev.find((d) => d.dishId === dishId);
      if (found) return prev.map((d) => (d.dishId === dishId ? { ...d, qty: d.qty + 1 } : d));
      return prev.concat([{ dishId, name, qty: 1 }]);
    });
    setQuery("");
  };

  const total = draft.reduce((a, d) => a + d.qty, 0);

  return (
    <div className={s.ringIn}>
      <h3 className={s.sectionTitle} style={{ fontSize: 17 }}>
        Ring in a round
      </h3>

      <input
        className={s.input}
        value={query}
        placeholder="Start typing a dish…"
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.trim() && matches.length === 0 && (
        <p className={s.sub} style={{ margin: 0 }}>
          Nothing on the menu matches — or it&rsquo;s been 86&rsquo;d.
        </p>
      )}

      {matches.length > 0 && (
        <div className={s.suggestions}>
          {matches.map((d) => (
            <button key={d.id} type="button" className={s.btn} onClick={() => addDish(d.id, d.name)}>
              {d.name} · {money(d.price)}
            </button>
          ))}
        </div>
      )}

      {draft.length > 0 && (
        <>
          <div className={s.draft}>
            {draft.map((d) => (
              <div key={d.dishId} className={s.draftLine}>
                <span>
                  {d.qty}× {d.name}
                </span>
                <div className={s.actions}>
                  <button
                    type="button"
                    className={s.btn}
                    aria-label={`One fewer ${d.name}`}
                    onClick={() =>
                      setDraft((prev) =>
                        prev
                          .map((x) => (x.dishId === d.dishId ? { ...x, qty: x.qty - 1 } : x))
                          .filter((x) => x.qty > 0),
                      )
                    }
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={s.btn}
                    aria-label={`One more ${d.name}`}
                    onClick={() => addDish(d.dishId, d.name)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <input
            className={s.input}
            value={note}
            placeholder="Note for the kitchen (optional)"
            onChange={(e) => setNote(e.target.value)}
          />

          <div className={s.formFooter}>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              disabled={disabled || total === 0}
              onClick={async () => {
                const ok = await onSend(
                  draft.map((d) => ({ dishId: d.dishId, qty: d.qty, exclusions: [], note: note.trim() })),
                );
                if (ok) {
                  setDraft([]);
                  setNote("");
                }
              }}
            >
              Send {total} {total === 1 ? "item" : "items"} to the kitchen
            </button>
            <button type="button" className={s.btn} onClick={() => setDraft([])}>
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}
