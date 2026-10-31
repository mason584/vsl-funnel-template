import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, visits } from "@/db/schema";
import { DIRECT, filtersHref, leadsWhere, pct, visitsWhere, type Filters } from "./filters";

/**
 * La provenance : d'où viennent les visites, et ce qu'elles deviennent.
 *
 * Une ligne par `utm_source` (« direct » quand il n'y en a pas), avec les
 * sessions qui ont vu la landing, les leads démarrés, les rendez-vous pris,
 * et les taux. C'est la réponse à « quelle campagne ramène des rendez-vous »,
 * sans dépendre d'un outil tiers. Cliquer une source filtre tout le reste.
 *
 * `utm_campaign` est détaillée dans une seconde table : la source dit le
 * canal, la campagne dit le message.
 */

type Row = { key: string; visits: number; leads: number; booked: number };

async function breakdown(filters: Filters, field: "utm_source" | "utm_campaign"): Promise<Row[]> {
  const scoped = { ...filters, statut: null, etape: null, q: "" };
  // Le nom du champ et le repli sont inlinés, pas passés en paramètres : avec
  // des paramètres, le `select` et le `group by` reçoivent des numéros
  // différents ($1 puis $4), Postgres ne reconnaît plus la même expression
  // et refuse la requête. Les deux valeurs viennent du code, jamais de l'URL.
  const keyOf = (col: typeof visits.utm | typeof leads.utm) =>
    sql<string>`coalesce(nullif(${col}->>${sql.raw(`'${field}'`)}, ''), ${sql.raw(`'${DIRECT}'`)})`;

  const [visitRows, leadRows] = await Promise.all([
    db
      .select({ key: keyOf(visits.utm), total: sql<number>`count(distinct ${visits.sessionId})::int` })
      .from(visits)
      .where(visitsWhere(scoped))
      .groupBy(keyOf(visits.utm)),
    db
      .select({
        key: keyOf(leads.utm),
        total: sql<number>`count(*)::int`,
        booked: sql<number>`count(*) filter (where ${leads.status} = 'booked')::int`,
      })
      .from(leads)
      .where(leadsWhere(scoped))
      .groupBy(keyOf(leads.utm)),
  ]);

  const rows = new Map<string, Row>();
  for (const r of visitRows) rows.set(r.key, { key: r.key, visits: r.total, leads: 0, booked: 0 });
  for (const r of leadRows) {
    const row = rows.get(r.key) ?? { key: r.key, visits: 0, leads: 0, booked: 0 };
    row.leads = r.total;
    row.booked = r.booked;
    rows.set(r.key, row);
  }
  return [...rows.values()].sort((a, b) => b.booked - a.booked || b.leads - a.leads || b.visits - a.visits);
}

function Table({
  rows,
  label,
  filters,
  clickable,
}: {
  rows: Row[];
  label: string;
  filters: Filters;
  clickable: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-[var(--border-strong)] px-6 py-8 text-center text-sm text-[var(--text-muted)]">
        Aucune visite sur cette période.
      </p>
    );
  }

  const show = (v: number | null) => (v === null ? "—" : `${v} %`);

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border-soft)] bg-[var(--panel)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <th className="px-4 py-3 font-medium">{label}</th>
            <th className="px-4 py-3 text-right font-medium">Visites</th>
            <th className="px-4 py-3 text-right font-medium">Leads</th>
            <th className="px-4 py-3 text-right font-medium">RDV</th>
            <th className="px-4 py-3 text-right font-medium">Visite → lead</th>
            <th className="px-4 py-3 text-right font-medium">Lead → RDV</th>
            <th className="px-4 py-3 text-right font-medium">Visite → RDV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = filters.source === row.key;
            return (
              <tr key={row.key} className="border-b border-[var(--border-soft)] last:border-0">
                <td className="px-4 py-3">
                  {clickable ? (
                    <Link
                      href={filtersHref("/admin", { ...filters, source: active ? null : row.key, page: 1 })}
                      className={`font-mono text-xs ${active ? "font-semibold" : ""}`}
                    >
                      {row.key}
                      {active ? " ✕" : ""}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{row.key}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{row.visits}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.leads}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{row.booked}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--text-muted)]">
                  {show(pct(row.leads, row.visits))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--text-muted)]">
                  {show(pct(row.booked, row.leads))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--text-muted)]">
                  {show(pct(row.booked, row.visits))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export async function Provenance({ filters }: { filters: Filters }) {
  let sources: Row[] = [];
  let campaigns: Row[] = [];
  try {
    [sources, campaigns] = await Promise.all([
      breakdown(filters, "utm_source"),
      breakdown(filters, "utm_campaign"),
    ]);
  } catch (error) {
    console.error("Provenance illisible", error);
    return null;
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[24px]">Provenance</h2>
        <a
          href={`/admin/visites/export${filtersHref("", { ...filters, page: 1 })}`}
          download
          className="text-sm text-[var(--link)]"
        >
          Exporter les visites (CSV) →
        </a>
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Une visite = une session qui a chargé une page du tunnel. La source vient de
        l&apos;<code>utm_source</code> de l&apos;URL d&apos;arrivée, « direct » quand il n&apos;y en a
        pas. Clique une source pour filtrer tout le tableau de bord dessus.
      </p>

      <Table rows={sources} label="utm_source" filters={filters} clickable />

      {campaigns.some((c) => c.key !== DIRECT) && (
        <>
          <h3 className="mt-8 font-display text-[18px]">Par campagne</h3>
          <Table rows={campaigns} label="utm_campaign" filters={filters} clickable={false} />
        </>
      )}
    </section>
  );
}
