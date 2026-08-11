"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category } from "@/data/menu";
import { exclusionLine } from "@/lib/bag";
import { money } from "@/lib/money";
import type { TableTab } from "@/server/tables";
import s from "../admin.module.css";

const POLL_MS = 6000;

export function FloorPlan({ categories }: { categories: Category[] }) {
  const [tables, setTables] = useState<TableTab[] | null>(null);
  const [openTable, setOpenTable] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tables", { cache: "no-store" });
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

  const act = async (body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || data.error) setError(data.error ?? "That didn't go through.");
      await load();
      return res.ok;
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
          Open on tabs: <strong>{money(seated.reduce((a, t) => a + t.outstanding, 0))}</strong>
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
            onClick={() => setOpenTable(openTable === t.tableId ? null : t.tableId)}
          >
            <span className={s.tableLabel}>{t.label}</span>
            {t.sessionId ? (
              <>
                <span className={s.tableTotal}>{money(t.total)}</span>
                <span className={s.tableMeta}>
                  {t.rounds.length} {t.rounds.length === 1 ? "round" : "rounds"}
                  {t.outstanding > 0 ? ` · ${money(t.outstanding)} due` : " · settled up"}
                </span>
              </>
            ) : (
              <span className={s.tableFree}>Free</span>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className={s.card}>
          <div className={s.tabHead}>
            <h2 className={s.sectionTitle} style={{ margin: 0 }}>
              {selected.label}
            </h2>
            <div className={s.tabTotals}>
              <span>
                Total <strong>{money(selected.total)}</strong>
              </span>
              <span>
                Outstanding <strong>{money(selected.outstanding)}</strong>
              </span>
            </div>
          </div>

          {selected.rounds.length === 0 ? (
            <p className={s.sub}>Nothing ordered yet. Ring the first round in below.</p>
          ) : (
            <>
              <div className={s.rollup}>
                {selected.items.map((i) => (
                  <span key={i.name} className={s.rollupItem}>
                    {i.qty}× {i.name}
                  </span>
                ))}
              </div>

              {selected.rounds.map((round) => (
                <div key={round.orderNo} className={s.round}>
                  <div className={s.roundHead}>
                    <span className={s.roundNo}>{round.orderNo}</span>
                    <span className={s.roundBadge} data-channel={round.channel}>
                      {round.channel === "staff" ? "Rung in" : "From the table"}
                    </span>
                    <span className={s.roundBadge} data-payment={round.paymentStatus}>
                      {round.paymentStatus === "paid" ? "Paid" : "On the tab"}
                    </span>
                    <span className={s.roundTotal}>{money(round.total)}</span>
                  </div>
                  {round.lines.map((l, i) => (
                    <div key={`${l.dishId}-${i}`} className={s.roundLine}>
                      <span>
                        {l.qty}× {l.name}
                      </span>
                      {l.exclusions.length > 0 && (
                        <span className={s.ticketExcl}>{exclusionLine(l.exclusions)}</span>
                      )}
                      {l.note && <span className={s.ticketNote}>&ldquo;{l.note}&rdquo;</span>}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          <RingIn
            categories={categories}
            disabled={busy}
            onSend={(lines) => act({ action: "order", tableId: selected.tableId, lines })}
          />

          {selected.sessionId && (
            <div className={s.formFooter} style={{ marginTop: 18 }}>
              <button
                type="button"
                className={`${s.btn} ${s.btnPrimary}`}
                disabled={busy}
                onClick={() => {
                  const owed = money(selected.outstanding);
                  if (
                    confirm(
                      selected.outstanding > 0
                        ? `Settle ${selected.label} and take ${owed}? This closes the tab.`
                        : `Close ${selected.label}? Everything is already paid.`,
                    )
                  ) {
                    act({ action: "settle", tableId: selected.tableId }).then(() =>
                      setOpenTable(null),
                    );
                  }
                }}
              >
                Settle and free the table
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
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

      {matches.length > 0 && (
        <div className={s.suggestions}>
          {matches.map((d) => (
            <button
              key={d.id}
              type="button"
              className={s.btn}
              onClick={() => addDish(d.id, d.name)}
            >
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
                  draft.map((d) => ({
                    dishId: d.dishId,
                    qty: d.qty,
                    exclusions: [],
                    note: note.trim(),
                  })),
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
