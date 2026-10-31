import { and, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { leads, visits } from "@/db/schema";
import { isStage } from "@/lib/funnel";

/**
 * Les filtres de l'administration, partagés par le tableau de bord, la table
 * et les exports : ce qu'on voit à l'écran est exactement ce qui part dans le
 * fichier.
 */

export const PERIODES = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "tout", label: "Tout" },
] as const;
export type Periode = (typeof PERIODES)[number]["value"];

export const STATUTS = ["partial", "qualified", "disqualified", "booked"] as const;
export type Statut = (typeof STATUTS)[number];

export const STATUT_LABELS: Record<string, string> = {
  partial: "En cours",
  qualified: "Qualifié",
  disqualified: "Hors critères",
  booked: "RDV pris",
};

export const PAGE_SIZE = 25;

export type Filters = {
  periode: Periode;
  statut: Statut | null;
  /** Dernier écran atteint — vient d'un clic sur l'entonnoir. */
  etape: string | null;
  /** `utm_source` exact — vient d'un clic sur la table de provenance. */
  source: string | null;
  /** Recherche par nom, email ou téléphone. */
  q: string;
  page: number;
};

export function parseFilters(sp: Record<string, string | undefined>): Filters {
  const page = Number.parseInt(sp.page ?? "1", 10);
  return {
    periode: PERIODES.some((p) => p.value === sp.periode) ? (sp.periode as Periode) : "30",
    statut: STATUTS.includes(sp.statut as Statut) ? (sp.statut as Statut) : null,
    etape: isStage(sp.etape) ? (sp.etape as string) : null,
    source: (sp.source ?? "").trim().slice(0, 80) || null,
    q: (sp.q ?? "").trim().slice(0, 80),
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

export function periodeSince(f: Filters): Date | null {
  if (f.periode === "tout") return null;
  return new Date(Date.now() - Number(f.periode) * 24 * 3600 * 1000);
}

/** La source d'une ligne : `utm_source`, ou « direct » quand il n'y en a pas. */
export const DIRECT = "direct";

function sourceCondition(column: typeof leads.utm | typeof visits.utm, source: string): SQL {
  return source === DIRECT
    ? sql`coalesce(${column}->>'utm_source', '') = ''`
    : sql`${column}->>'utm_source' = ${source}`;
}

export function leadsWhere(f: Filters): SQL | undefined {
  const conds: SQL[] = [];
  const since = periodeSince(f);
  if (since) conds.push(gte(leads.createdAt, since));
  if (f.statut) conds.push(eq(leads.status, f.statut));
  if (f.etape) conds.push(eq(leads.stepReached, f.etape));
  if (f.source) conds.push(sourceCondition(leads.utm, f.source));
  if (f.q) {
    // Un opérateur cherche « camille », « @exemple.com » ou « 0612 » — tout
    // doit trouver, sans distinction de casse.
    const like = `%${f.q}%`;
    const search = or(
      ilike(leads.firstName, like),
      ilike(leads.lastName, like),
      ilike(leads.email, like),
      ilike(leads.phoneNumber, like)
    );
    if (search) conds.push(search);
  }
  return conds.length > 0 ? and(...conds) : undefined;
}

export function visitsWhere(f: Filters): SQL | undefined {
  const conds: SQL[] = [];
  const since = periodeSince(f);
  if (since) conds.push(gte(visits.createdAt, since));
  if (f.source) conds.push(sourceCondition(visits.utm, f.source));
  return conds.length > 0 ? and(...conds) : undefined;
}

export function leadsOrder(): SQL[] {
  return [desc(leads.updatedAt)];
}

export function filtersQuery(f: Filters): string {
  const params = new URLSearchParams();
  if (f.periode !== "30") params.set("periode", f.periode);
  if (f.statut) params.set("statut", f.statut);
  if (f.etape) params.set("etape", f.etape);
  if (f.source) params.set("source", f.source);
  if (f.q) params.set("q", f.q);
  if (f.page > 1) params.set("page", String(f.page));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function filtersHref(base: string, f: Filters): string {
  return `${base}${filtersQuery(f)}`;
}

/** Les puces de filtre : la même pilule partout. */
export function chipClass(active: boolean): string {
  return active
    ? "inline-flex items-center rounded-full bg-[var(--inverse)] px-3 py-1.5 text-xs text-[var(--text-on-inverse)] no-underline"
    : "inline-flex items-center rounded-full border border-[var(--border-soft)] px-3 py-1.5 text-xs no-underline hover:bg-[var(--panel-accent)]";
}

/** Dates en heure de Paris — la table, la fiche et l'export lisent pareil. */
export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(d);
}

export function formatLongDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(d);
}

/** Temps passé sur le formulaire, entre la première et la dernière action. */
export function formatDuration(row: { createdAt: Date; updatedAt: Date }): string {
  const ms = row.updatedAt.getTime() - row.createdAt.getTime();
  if (ms < 1000) return "—";
  const seconds = Math.round(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}

export function utmSummary(utm: unknown): string {
  const record = (utm ?? {}) as Record<string, string>;
  const parts = [record.utm_source, record.utm_medium, record.utm_campaign].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  return record.fbclid ? "fbclid" : "—";
}

/** Un pourcentage entier, ou null quand le dénominateur manque. */
export function pct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 100) : null;
}
