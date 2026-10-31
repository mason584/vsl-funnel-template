import { desc } from "drizzle-orm";
import { db } from "@/db";
import { visits } from "@/db/schema";
import { isSignedIn } from "@/lib/auth";
import { parseFilters, visitsWhere } from "../../filters";

/**
 * Export CSV des visites — une ligne par chargement de page, avec sa
 * provenance. C'est la donnée brute du tableau de bord : pour recouper avec
 * le gestionnaire de publicités, ou refaire les taux dans un tableur.
 */
export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Paris",
});

function cell(value: string | null | undefined): string {
  const v = (value ?? "").replace(/\r?\n/g, " ").trim();
  return /[;"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(request: Request) {
  if (!(await isSignedIn())) {
    return new Response("Non autorisé", { status: 401 });
  }

  const url = new URL(request.url);
  const filters = parseFilters(Object.fromEntries(url.searchParams));

  const rows = await db
    .select()
    .from(visits)
    .where(visitsWhere(filters))
    .orderBy(desc(visits.createdAt))
    .limit(50_000);

  const header = [
    "Quand",
    "Session",
    "Page",
    "Pays",
    "Referrer",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "gclid",
    "URL d'arrivée",
    "Navigateur",
  ];

  const lines = rows.map((row) => {
    const utm = (row.utm ?? {}) as Record<string, string>;
    return [
      DATE_FMT.format(row.createdAt),
      row.sessionId,
      row.path,
      row.country,
      row.referrer,
      utm.utm_source,
      utm.utm_medium,
      utm.utm_campaign,
      utm.utm_content,
      utm.utm_term,
      utm.fbclid,
      utm.gclid,
      row.landingUrl,
      row.userAgent,
    ]
      .map(cell)
      .join(";");
  });

  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="visites-${today}.csv"`,
    },
  });
}
