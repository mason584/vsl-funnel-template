import Link from "next/link";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, visits } from "@/db/schema";
import { LEAD_STAGES, VISIT_STAGES, stageRank } from "@/lib/funnel";
import { filtersHref, leadsWhere, visitsWhere, type Filters } from "./filters";

/**
 * L'entonnoir du tunnel.
 *
 * Les étages ne sont pas codés en dur : visites de la landing, visites du
 * formulaire, puis chaque question dans l'ordre, les créneaux, la réservation.
 * Ajouter une question au formulaire ajoute un étage — l'entonnoir suit le
 * contenu, il ne le décrit pas de son côté.
 *
 * Largeur d'un étage = les gens qui l'ont AU MOINS atteint. Les points posés
 * dedans = ceux qui se sont arrêtés LÀ. Le pourcentage se lit contre la marche
 * précédente. Cliquer un étage de lead filtre la table sur ces personnes.
 *
 * L'entonnoir suit la période et la source choisies, pas le statut ni la
 * recherche : c'est la carte, la table est le détail.
 */

const W = 640;
const BAND_H = 46;
const GAP = 4;
const TOP = 6;
const MAX_W = 600;
const MIN_W = 140;
const DOT_R = 4;
const DOT_GAP = 12;
const MAX_DOTS = 20;

export type FunnelCounts = {
  /** Sessions distinctes par page de visite. */
  visits: Record<string, number>;
  /** Leads ayant au moins atteint chaque étape. */
  reached: number[];
  /** Leads arrêtés exactement à chaque étape. */
  parked: number[];
};

/** Les comptes de l'entonnoir, partagés avec les tuiles du tableau de bord. */
export async function funnelCounts(filters: Filters): Promise<FunnelCounts> {
  const scoped = { ...filters, statut: null, etape: null, q: "" };

  const [visitRows, leadRows] = await Promise.all([
    db
      .select({ path: visits.path, total: sql<number>`count(distinct ${visits.sessionId})::int` })
      .from(visits)
      .where(visitsWhere(scoped))
      .groupBy(visits.path),
    db.select({ stepReached: leads.stepReached }).from(leads).where(leadsWhere(scoped)),
  ]);

  const visitCounts: Record<string, number> = {};
  for (const stage of VISIT_STAGES) {
    visitCounts[stage.key] = visitRows.find((r) => r.path === stage.path)?.total ?? 0;
  }

  const ranks = leadRows.map((r) => stageRank(r.stepReached));
  return {
    visits: visitCounts,
    reached: LEAD_STAGES.map((s) => ranks.filter((r) => r >= s.rank).length),
    parked: LEAD_STAGES.map((s) => ranks.filter((r) => r === s.rank).length),
  };
}

/** Combien de réservations ont ensuite ouvert l'immersion — la dernière marche. */
export async function immersionCount(filters: Filters): Promise<number> {
  const scoped = { ...filters, statut: null, etape: null, q: "" };
  const [row] = await db
    .select({ total: count() })
    .from(visits)
    .where(and(visitsWhere(scoped), eq(visits.path, "/immersion")));
  return row?.total ?? 0;
}

export function FunnelViz({ filters, counts }: { filters: Filters; counts: FunnelCounts }) {
  const bands = [
    ...VISIT_STAGES.map((s) => ({
      key: s.key,
      label: s.label,
      count: counts.visits[s.key] ?? 0,
      parked: 0,
      clickable: false,
    })),
    ...LEAD_STAGES.map((s, i) => ({
      key: s.key,
      label: s.label,
      count: counts.reached[i],
      parked: counts.parked[i],
      clickable: true,
    })),
  ];

  const maxCount = Math.max(1, ...bands.map((b) => b.count));
  const height = TOP + bands.length * (BAND_H + GAP);
  const widths = bands.map((b) => MIN_W + ((MAX_W - MIN_W) * b.count) / maxCount);

  return (
    <section className="mt-8 rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
      <h2 className="font-display text-[24px]">Entonnoir</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Un point = une personne arrêtée à cette étape. Clique un étage pour voir qui s&apos;y
        trouve ; le pourcentage se lit contre la marche précédente.
      </p>

      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label="Entonnoir du tunnel"
        className="mx-auto mt-5 block w-full max-w-2xl"
      >
        <defs>
          <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--panel-accent)" />
            <stop offset="100%" stopColor="var(--panel)" />
          </linearGradient>
        </defs>

        {bands.map((band, i) => {
          const y = TOP + i * (BAND_H + GAP);
          const topW = widths[i];
          const botW = i + 1 < widths.length ? widths[i + 1] : widths[i] * 0.9;
          const cx = W / 2;
          const path = [
            `M ${cx - topW / 2},${y}`,
            `L ${cx + topW / 2},${y}`,
            `L ${cx + botW / 2},${y + BAND_H}`,
            `L ${cx - botW / 2},${y + BAND_H}`,
            "Z",
          ].join(" ");

          const active = filters.etape === band.key;
          const href = filtersHref("/admin/leads", {
            ...filters,
            etape: active ? null : band.key,
            page: 1,
          });

          const prev = i > 0 ? bands[i - 1].count : band.count;
          const pct = i > 0 && prev > 0 ? Math.round((band.count / prev) * 100) : null;

          const dots = Math.min(band.parked, MAX_DOTS);
          const perRow = Math.max(6, Math.floor((Math.min(topW, botW) * 0.8) / DOT_GAP));

          const shape = (
            <>
              <path
                d={path}
                fill={active ? "var(--panel-accent)" : "url(#band)"}
                stroke={active ? "var(--accent)" : "var(--border-soft)"}
                strokeWidth={active ? 1.5 : 1}
              />
              <text
                x={cx}
                y={y + 18}
                textAnchor="middle"
                fontSize={11.5}
                fill="var(--text)"
                fontWeight={active ? 600 : 400}
              >
                {band.label} — {band.count}
              </text>
              {pct !== null && (
                <text
                  x={W - 4}
                  y={y + BAND_H / 2 + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--text-muted)"
                >
                  {pct} %
                </text>
              )}
              {Array.from({ length: dots }, (_, j) => {
                const row = Math.floor(j / perRow);
                const inRow = Math.min(dots - row * perRow, perRow);
                const col = j % perRow;
                const x = cx - ((inRow - 1) * DOT_GAP) / 2 + col * DOT_GAP;
                return (
                  <circle
                    key={j}
                    cx={x}
                    cy={y + 32 + row * 10}
                    r={DOT_R}
                    fill="var(--accent)"
                    opacity={0.85}
                  />
                );
              })}
              {band.parked > MAX_DOTS && (
                <text
                  x={cx + ((perRow - 1) * DOT_GAP) / 2 + 12}
                  y={y + 36}
                  fontSize={10}
                  fill="var(--text-muted)"
                >
                  +{band.parked - MAX_DOTS}
                </text>
              )}
            </>
          );

          // Les visites ne sont pas une étape de lead : rien à filtrer.
          return band.clickable ? (
            <Link key={band.key} href={href} className="cursor-pointer">
              {shape}
            </Link>
          ) : (
            <g key={band.key}>{shape}</g>
          );
        })}
      </svg>
    </section>
  );
}
