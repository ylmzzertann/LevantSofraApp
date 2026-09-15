import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireStaff } from "@/server/staff";
import { tableUrl } from "@/server/table-keys";
import { listTables } from "@/server/tables";
import { PrintButton, TableAdmin } from "./TableAdmin";
import s from "../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * The address baked into the stickers. PUBLIC_BASE_URL wins, because a QR
 * printed while someone was browsing `localhost` would be useless on a table.
 */
async function baseUrl(): Promise<string> {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function QrPage() {
  await requireStaff("owner");
  const tables = await listTables();
  const base = await baseUrl();
  const active = tables.filter((t) => t.active);

  const stickers = await Promise.all(
    active.map(async (t) => {
      const url = tableUrl(base, t.id);
      const svg = url
        ? await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
        : null;
      return { ...t, url, svg };
    }),
  );

  const unsigned = stickers.some((t) => !t.url);
  const localOnly = !process.env.PUBLIC_BASE_URL && /localhost|127\.0\.0\.1/.test(base);

  return (
    <div className={s.page}>
      <div className={s.noPrint}>
        <h1 className={s.heading}>Tables &amp; QR codes</h1>
        <p className={s.sub}>
          Each sticker carries a signature only this server can make, so knowing a table number
          isn&rsquo;t enough to order to it. Print, cut, stick one on each table.
        </p>

        {unsigned && (
          <div className={s.warning}>
            APP_SECRET isn&rsquo;t set on the server, so table codes can&rsquo;t be signed and table
            ordering is switched off. Set it (16+ random characters) and reload.
          </div>
        )}
        {localOnly && (
          <div className={s.warning}>
            These codes point at <code>{base}</code>, which only works on this computer. Set
            PUBLIC_BASE_URL to the real site address before printing.
          </div>
        )}

        <TableAdmin tables={tables} />

        <div className={s.formFooter} style={{ margin: "18px 0" }}>
          <PrintButton />
        </div>
      </div>

      <div className={s.qrGrid}>
        {stickers.map((t) => (
          <div key={t.id} className={s.qrCard}>
            {t.svg ? (
              // The SVG is generated on our own server from our own URL.
              <div dangerouslySetInnerHTML={{ __html: t.svg }} />
            ) : (
              <p className={s.sub}>Not signed</p>
            )}
            <div className={s.qrLabel}>{t.label}</div>
            <div className={s.qrHint}>Scan to order from your seat</div>
            {t.url && (
              // On screen only: lets an owner test a sticker without a phone.
              <a href={t.url} className={`${s.qrHint} ${s.noPrint}`} target="_blank" rel="noreferrer">
                Open this table&rsquo;s link
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
