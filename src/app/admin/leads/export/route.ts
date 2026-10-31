import { db } from "@/db";
import { leads } from "@/db/schema";
import { FORM } from "@/content/form";
import { answerToText } from "@/lib/answers";
import { isSignedIn } from "@/lib/auth";
import { stageLabel } from "@/lib/funnel";
import { leadsOrder, leadsWhere, parseFilters } from "../../filters";

/**
 * Export CSV des leads, avec exactement les filtres de la table : ce qu'on
 * voit à l'écran est ce qui part dans le fichier.
 *
 * Format pensé pour Excel en français : séparateur « ; », BOM UTF-8 pour que
 * les accents s'affichent, dates en heure de Paris. Une colonne par question
 * du formulaire, dans l'ordre où elles sont posées.
 */
export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function cell(value: string | null | undefined): string {
  const v = (value ?? "").replace(/\r?\n/g, " ").trim();
  return /[;"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(request: Request) {
  // Un export est la sortie la plus sensible de l'application : le garde est
  // ici, dans la route elle-même, et pas seulement dans le middleware.
  if (!(await isSignedIn())) {
    return new Response("Non autorisé", { status: 401 });
  }

  const url = new URL(request.url);
  const filters = parseFilters(Object.fromEntries(url.searchParams));

  const rows = await db
    .select()
    .from(leads)
    .where(leadsWhere(filters))
    .orderBy(...leadsOrder());

  const header = [
    "Arrivé le",
    "Dernière action",
    "Terminé le",
    "Prénom",
    "Nom",
    "Email",
    "Téléphone",
    "Statut",
    "Dernière étape",
    "Écarté sur",
    ...FORM.questions.map((q) => q.label),
    "Créneau",
    "Contact iClosed",
    "Rendez-vous iClosed",
    "Erreur iClosed",
    "Touche Meta",
    "Événement Meta envoyé le",
    "Trace Meta",
    "Relecture",
    "Motif de la relecture",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "URL d'arrivée",
  ];

  const lines = rows.map((row) => {
    const answers = (row.answers ?? {}) as Record<string, never>;
    const utm = (row.utm ?? {}) as Record<string, string>;
    const faulty = (row.disqualifiedBy ?? []) as string[];

    return [
      DATE_FMT.format(row.createdAt),
      DATE_FMT.format(row.updatedAt),
      row.completedAt ? DATE_FMT.format(row.completedAt) : "",
      row.firstName,
      row.lastName,
      row.email,
      row.phoneNumber,
      row.status,
      stageLabel(row.stepReached),
      faulty.join(" · "),
      ...FORM.questions.map((q) => answerToText(q, answers[q.id])),
      row.slotIso ? DATE_FMT.format(new Date(row.slotIso)) : "",
      row.iclosedContactId,
      row.iclosedBookingId,
      row.iclosedError,
      row.metaTouch,
      row.metaEventSentAt ? DATE_FMT.format(row.metaEventSentAt) : "",
      row.metaEventDetail,
      row.reviewVerdict === "qualified" ? "retenue" : row.reviewVerdict === "unqualified" ? "écartée" : "",
      row.reviewReason,
      utm.utm_source,
      utm.utm_medium,
      utm.utm_campaign,
      utm.utm_content,
      utm.utm_term,
      utm.fbclid,
      row.landingUrl,
    ]
      .map(cell)
      .join(";");
  });

  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${today}.csv"`,
    },
  });
}
