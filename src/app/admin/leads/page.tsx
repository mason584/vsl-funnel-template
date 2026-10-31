import Link from "next/link";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { leads, type LeadRow } from "@/db/schema";
import { FORM } from "@/content/form";
import { answerToText } from "@/lib/answers";
import { requireAdmin } from "@/lib/admin";
import { stageLabel } from "@/lib/funnel";
import {
  PAGE_SIZE,
  PERIODES,
  STATUTS,
  STATUT_LABELS,
  chipClass,
  filtersHref,
  filtersQuery,
  formatDate,
  formatDuration,
  leadsOrder,
  leadsWhere,
  parseFilters,
  utmSummary,
  type Filters,
} from "../filters";

/**
 * La table des leads.
 *
 * Une ligne existe dès le premier écran validé : la colonne « étape » dit où
 * chacun a décroché, et c'est toute la valeur de cette vue. Chaque ligne ouvre
 * la fiche complète.
 */
export const dynamic = "force-dynamic";

/** La première question à choix unique, pour une colonne de synthèse (le CA, en général). */
const SUMMARY_QUESTION = FORM.questions.find((q) => q.kind === "single");

function summaryColumn(row: LeadRow): string {
  if (!SUMMARY_QUESTION) return "—";
  const answers = (row.answers ?? {}) as Record<string, never>;
  return answerToText(SUMMARY_QUESTION, answers[SUMMARY_QUESTION.id]) || "—";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "booked")
    return (
      <span className="rounded bg-[var(--ok-soft)] px-1.5 py-0.5 text-xs text-[var(--ok)]">RDV pris</span>
    );
  if (status === "disqualified")
    return (
      <span className="rounded bg-[var(--warn-bg)] px-1.5 py-0.5 text-xs text-[var(--warn-text)]">
        Hors critères
      </span>
    );
  if (status === "qualified") return <span className="text-xs">Qualifié</span>;
  return <span className="text-xs text-[var(--text-muted)]">En cours</span>;
}

function Pagination({ filters, total }: { filters: Filters; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pages);

  return (
    <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-muted)]">
      <span>
        {total} lead{total > 1 ? "s" : ""} · page {page} / {pages}
      </span>
      <span className="ml-auto flex gap-2">
        {page > 1 && (
          <Link href={filtersHref("/admin/leads", { ...filters, page: page - 1 })} className={chipClass(false)}>
            ← Précédents
          </Link>
        )}
        {page < pages && (
          <Link href={filtersHref("/admin/leads", { ...filters, page: page + 1 })} className={chipClass(false)}>
            Suivants →
          </Link>
        )}
      </span>
    </div>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const filters = parseFilters(await searchParams);

  let rows: LeadRow[] = [];
  let total = 0;
  try {
    const where = leadsWhere(filters);
    const [list, [totals]] = await Promise.all([
      db
        .select()
        .from(leads)
        .where(where)
        .orderBy(...leadsOrder())
        .limit(PAGE_SIZE)
        .offset((filters.page - 1) * PAGE_SIZE),
      db.select({ total: count() }).from(leads).where(where),
    ]);
    rows = list;
    total = totals?.total ?? 0;
  } catch (error) {
    console.error("Leads illisibles", error);
    return (
      <div className="max-w-6xl">
        <h1 className="font-display text-[32px]">Leads</h1>
        <p className="mt-4 text-sm text-[var(--text-muted)]">Impossible de lire les leads pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-[32px]">Leads</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Une ligne par visiteur, dès le premier écran validé. Clique une ligne pour ouvrir la fiche
        complète avec toutes les réponses, la réservation et la trace Meta.
      </p>

      {/* ── Filtres ────────────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {PERIODES.map((p) => (
          <Link
            key={p.value}
            href={filtersHref("/admin/leads", { ...filters, periode: p.value, page: 1 })}
            className={chipClass(filters.periode === p.value)}
          >
            {p.label}
          </Link>
        ))}

        <span className="mx-1 h-4 w-px bg-[var(--border-soft)]" aria-hidden />

        <Link
          href={filtersHref("/admin/leads", { ...filters, statut: null, page: 1 })}
          className={chipClass(filters.statut === null)}
        >
          Tous
        </Link>
        {STATUTS.map((statut) => (
          <Link
            key={statut}
            href={filtersHref("/admin/leads", { ...filters, statut, page: 1 })}
            className={chipClass(filters.statut === statut)}
          >
            {STATUT_LABELS[statut]}
          </Link>
        ))}

        {filters.etape && (
          <Link
            href={filtersHref("/admin/leads", { ...filters, etape: null, page: 1 })}
            className={chipClass(true)}
            title="Enlever le filtre d'étape"
          >
            Arrêtés à : {stageLabel(filters.etape)} ✕
          </Link>
        )}
        {filters.source && (
          <Link
            href={filtersHref("/admin/leads", { ...filters, source: null, page: 1 })}
            className={chipClass(true)}
            title="Enlever le filtre de source"
          >
            Source : {filters.source} ✕
          </Link>
        )}

        <a
          href={`/admin/leads/export${filtersQuery({ ...filters, page: 1 })}`}
          download
          className="ml-auto inline-flex min-h-9 items-center rounded-md bg-[var(--inverse)] px-4 text-xs text-[var(--text-on-inverse)] no-underline"
        >
          Exporter CSV
        </a>
      </div>

      {/* ── Recherche ──────────────────────────────────────────────────── */}
      <form method="get" className="mt-3 flex flex-wrap gap-2">
        {/* Les autres filtres survivent à la recherche : sans ces champs, une
            recherche remettrait la période et le statut à zéro. */}
        {filters.periode !== "30" && <input type="hidden" name="periode" value={filters.periode} />}
        {filters.statut && <input type="hidden" name="statut" value={filters.statut} />}
        {filters.etape && <input type="hidden" name="etape" value={filters.etape} />}
        {filters.source && <input type="hidden" name="source" value={filters.source} />}
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Chercher un nom, un email, un numéro"
          className="min-h-9 w-72 rounded-md border border-[var(--border-input)] bg-[var(--panel)] px-3 text-sm"
        />
        <button
          type="submit"
          className="inline-flex min-h-9 items-center rounded-md border border-[var(--border-input)] px-4 text-xs"
        >
          Chercher
        </button>
        {filters.q && (
          <Link href={filtersHref("/admin/leads", { ...filters, q: "", page: 1 })} className={chipClass(false)}>
            Effacer « {filters.q} »
          </Link>
        )}
      </form>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
          Aucun lead ne correspond à ces filtres.
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border-soft)] bg-[var(--panel)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-medium">Quand</th>
                  <th className="px-4 py-3 font-medium">Qui</th>
                  {SUMMARY_QUESTION && (
                    <th className="px-4 py-3 font-medium" title={SUMMARY_QUESTION.label}>
                      {SUMMARY_QUESTION.label.replace(/\s*\?$/, "").slice(0, 22)}
                    </th>
                  )}
                  <th className="px-4 py-3 font-medium">Étape</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">iClosed</th>
                  <th className="px-4 py-3 font-medium">Meta</th>
                  <th className="px-4 py-3 font-medium">Durée</th>
                  <th className="px-4 py-3 font-medium">Provenance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="relative border-b border-[var(--border-soft)] align-top transition-colors last:border-0 hover:bg-[var(--panel-accent)]"
                  >
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--text-muted)]">
                      {formatDate(row.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {/* Le lien s'étire sur toute la ligne : cliquer n'importe où ouvre la fiche. */}
                      <Link
                        href={`/admin/leads/${row.id}`}
                        className="font-medium no-underline after:absolute after:inset-0 after:content-['']"
                      >
                        {[row.firstName, row.lastName].filter(Boolean).join(" ") || "Anonyme"}
                      </Link>
                      <div className="text-xs text-[var(--text-muted)]">
                        {row.email ?? "—"}
                        {row.phoneNumber ? ` · ${row.phoneNumber}` : ""}
                      </div>
                    </td>
                    {SUMMARY_QUESTION && (
                      <td className="whitespace-nowrap px-4 py-3 text-xs">{summaryColumn(row)}</td>
                    )}
                    <td
                      className="max-w-40 truncate px-4 py-3 text-xs text-[var(--text-muted)]"
                      title={stageLabel(row.stepReached)}
                    >
                      {stageLabel(row.stepReached)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {row.iclosedBookingId ? (
                        <span title={`Rendez-vous ${row.iclosedBookingId}`}>✓ RDV</span>
                      ) : row.iclosedContactId ? (
                        <span title={`Contact ${row.iclosedContactId}`}>contact</span>
                      ) : row.iclosedError ? (
                        <span className="text-[var(--warn-text)]" title={row.iclosedError}>
                          erreur
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {row.metaEventSentAt ? (
                        <span title={row.metaEventDetail ?? ""}>✓ {formatDate(row.metaEventSentAt)}</span>
                      ) : row.status === "booked" && !row.metaTouch ? (
                        <span className="text-[var(--text-muted)]" title="Aucun clic Meta, premier ou dernier : rien ne part vers Meta.">
                          hors Meta
                        </span>
                      ) : row.reviewVerdict === "unqualified" ? (
                        <span className="text-[var(--warn-text)]" title={row.reviewReason ?? ""}>
                          écartée
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">{formatDuration(row)}</td>
                    <td
                      className="max-w-56 truncate px-4 py-3 text-xs text-[var(--text-muted)]"
                      title={row.landingUrl ?? ""}
                    >
                      {utmSummary(row.utm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination filters={filters} total={total} />
        </>
      )}
    </div>
  );
}
