import Link from "next/link";
import { db } from "@/db";
import { leads, type LeadRow } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { FORM_INLINE, LEAD_STAGES, stageShort } from "@/lib/funnel";
import { FunnelViz, funnelCounts, immersionCount, type FunnelCounts } from "./funnel";
import {
  PERIODES,
  chipClass,
  filtersHref,
  formatDate,
  leadsOrder,
  leadsWhere,
  parseFilters,
  pct,
  STATUT_LABELS,
} from "./filters";
import { Provenance } from "./provenance";

/**
 * Le tableau de bord : combien de gens voient la landing, combien démarrent
 * le formulaire, combien prennent rendez-vous, où les autres décrochent, et
 * d'où ils viennent.
 */
export const dynamic = "force-dynamic";

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 font-display text-[32px] leading-none tabular-nums">{value}</p>
      {note && <p className="mt-2 text-xs text-[var(--text-muted)]">{note}</p>}
    </div>
  );
}

const fr = (n: number) => n.toLocaleString("fr-FR");
const rate = (n: number | null, of: string) => (n === null ? undefined : `${n} % ${of}`);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const filters = parseFilters(await searchParams);

  let counts: FunnelCounts;
  let immersion = 0;
  let recent: LeadRow[] = [];
  try {
    [counts, immersion, recent] = await Promise.all([
      funnelCounts(filters),
      immersionCount(filters),
      db
        .select()
        .from(leads)
        .where(leadsWhere({ ...filters, statut: null, etape: null, q: "" }))
        .orderBy(...leadsOrder())
        .limit(8),
    ]);
  } catch (error) {
    console.error("Tableau de bord illisible", error);
    return (
      <div className="max-w-6xl">
        <h1 className="font-display text-[32px]">Tableau de bord</h1>
        <p className="mt-4 rounded-lg border border-dashed border-[var(--border-strong)] p-6 text-sm text-[var(--text-muted)]">
          La base de données est injoignable. Vérifie <code>DATABASE_URL</code>, puis recharge.
        </p>
      </div>
    );
  }

  const landing = counts.visits.landing ?? 0;
  const form = counts.visits.form ?? 0;
  const started = counts.reached[0] ?? 0;
  const bookedIndex = LEAD_STAGES.findIndex((s) => s.key === "booked");
  const booked = counts.reached[bookedIndex] ?? 0;

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-[32px]">Tableau de bord</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Le trafic, les leads et les rendez-vous sur la période choisie. La livraison des
        événements de conversion se vérifie dans Meta Events Manager, les rendez-vous dans
        iClosed.
      </p>

      {/* ── Filtres ────────────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {PERIODES.map((p) => (
          <Link
            key={p.value}
            href={filtersHref("/admin", { ...filters, periode: p.value, page: 1 })}
            className={chipClass(filters.periode === p.value)}
          >
            {p.label}
          </Link>
        ))}
        {filters.source && (
          <Link
            href={filtersHref("/admin", { ...filters, source: null, page: 1 })}
            className={chipClass(true)}
            title="Enlever le filtre de source"
          >
            Source : {filters.source} ✕
          </Link>
        )}
      </div>

      {/* ── Chiffres ───────────────────────────────────────────────────── */}
      <div className={`mt-6 grid gap-4 sm:grid-cols-2 ${FORM_INLINE ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
        <Tile label="Visites landing" value={fr(landing)} note="Sessions ayant chargé la page" />
        {!FORM_INLINE && (
          <Tile
            label="Formulaire ouvert"
            value={fr(form)}
            note={rate(pct(form, landing), "des visites")}
          />
        )}
        <Tile
          label="Leads démarrés"
          value={fr(started)}
          note={
            FORM_INLINE
              ? rate(pct(started, landing), "des visites")
              : rate(pct(started, form), "du formulaire ouvert")
          }
        />
        <Tile
          label="Rendez-vous pris"
          value={fr(booked)}
          note={rate(pct(booked, started), "des leads démarrés")}
        />
        <Tile
          label="Immersion vue"
          value={fr(immersion)}
          note={rate(pct(immersion, booked), "des rendez-vous")}
        />
      </div>

      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Taux global visite → rendez-vous :{" "}
        <strong className="text-[var(--text)]">
          {pct(booked, landing) === null ? "—" : `${pct(booked, landing)} %`}
        </strong>
      </p>

      {/* ── Entonnoir ──────────────────────────────────────────────────── */}
      <FunnelViz filters={filters} counts={counts} />

      {/* ── Provenance ─────────────────────────────────────────────────── */}
      <Provenance filters={filters} />

      {/* ── Derniers leads ─────────────────────────────────────────────── */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-[24px]">Derniers leads</h2>
          <Link href={filtersHref("/admin/leads", filters)} className="text-sm text-[var(--link)]">
            Tout voir →
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
            Aucun lead sur cette période. La première ligne apparaît dès qu&apos;un visiteur
            valide le premier écran du formulaire.
          </p>
        ) : (
          <ul className="mt-4 flex list-none flex-col gap-2 p-0">
            {recent.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/leads/${row.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border-soft)] bg-[var(--panel)] px-4 py-3 no-underline transition-colors hover:border-[var(--accent)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {[row.firstName, row.lastName].filter(Boolean).join(" ") || "Anonyme"}
                    </span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">{row.email ?? "—"}</span>
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {STATUT_LABELS[row.status] ?? row.status} · {stageShort(row.stepReached)} ·{" "}
                    {formatDate(row.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
