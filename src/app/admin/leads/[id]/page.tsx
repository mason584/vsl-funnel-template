import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads, type LeadRow } from "@/db/schema";
import { FORM } from "@/content/form";
import { THANKS } from "@/content/thanks";
import { answerToText } from "@/lib/answers";
import { requireAdmin } from "@/lib/admin";
import { stageLabel } from "@/lib/funnel";
import { formatDuration, formatLongDate, STATUT_LABELS } from "../../filters";
import { ResendButton } from "./resend-button";

/**
 * La fiche d'un lead : toutes les réponses dans les termes exacts posés au
 * visiteur, le verdict, la réservation iClosed, l'événement Meta et sa trace,
 * la provenance. C'est la page qu'on ouvre avant d'appeler quelqu'un.
 */
export const dynamic = "force-dynamic";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
      <h2 className="font-display text-[20px]">{title}</h2>
      {children}
    </section>
  );
}

/** Pourquoi l'événement n'est pas parti — la question qu'on se pose devant la fiche. */
function metaAbsenceReason(row: LeadRow): string {
  if (row.status !== "booked") return "L'événement part à la réservation du créneau.";
  if (!row.metaTouch)
    return "Trafic hors Meta — aucun clic Meta, premier ou dernier : rien ne part vers Meta, c'est le principe du montage.";
  if (row.reviewVerdict === "unqualified")
    return `Écartée par la relecture — ${row.reviewReason ?? "sans motif"}`;
  if (row.metaEventDetail) return row.metaEventDetail;
  return "L'envoi n'a pas encore abouti — voir les journaux du serveur.";
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  let row: LeadRow | undefined;
  try {
    [row] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  } catch {
    // Un id qui n'est pas un uuid fait échouer la requête : même réponse qu'un id inconnu.
    notFound();
  }
  if (!row) notFound();

  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || "Lead anonyme";
  const answers = (row.answers ?? {}) as Record<string, never>;
  const utm = (row.utm ?? {}) as Record<string, string>;
  const utmEntries = Object.entries(utm).filter(([, v]) => Boolean(v));
  const faulty = new Set((row.disqualifiedBy ?? []) as string[]);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/leads" className="text-sm text-[var(--text-muted)]">
        ← Leads
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-[32px]">{name}</h1>
        <span className="text-sm text-[var(--text-muted)]">
          {STATUT_LABELS[row.status] ?? row.status}
          {row.status !== "booked" && ` · ${stageLabel(row.stepReached)}`}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Arrivé le {formatLongDate(row.createdAt)} · dernière action le{" "}
        {formatLongDate(row.updatedAt)} · {formatDuration(row)} sur le formulaire
      </p>

      <div className="mt-8 grid gap-6">
        <Card title="Coordonnées">
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email">
              {row.email ? (
                <a href={`mailto:${row.email}`} className="underline underline-offset-2">
                  {row.email}
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Téléphone">
              {row.phoneNumber ? (
                <>
                  <a href={`tel:${row.phoneNumber}`} className="underline underline-offset-2">
                    {row.phoneNumber}
                  </a>
                  <a
                    href={`https://wa.me/${row.phoneNumber.replace(/\D/g, "")}`}
                    rel="noreferrer"
                    target="_blank"
                    className="ml-3 text-xs text-[var(--link)]"
                  >
                    WhatsApp ↗
                  </a>
                </>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Session">
              <span className="font-mono text-xs">{row.sessionId}</span>
            </Field>
            <Field label="Navigateur">
              <span className="break-all text-xs text-[var(--text-muted)]">{row.userAgent ?? "—"}</span>
            </Field>
          </dl>
        </Card>

        <Card title="Rendez-vous">
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Créneau">
              {row.slotIso ? formatLongDate(new Date(row.slotIso)) : <span className="text-[var(--text-muted)]">Pas encore réservé</span>}
            </Field>
            <Field label="Contact iClosed">
              {row.iclosedContactId ? (
                <span className="font-mono text-xs">{row.iclosedContactId}</span>
              ) : (
                <span className="text-[var(--text-muted)]">
                  {row.email || row.phoneNumber ? "Jamais poussé vers iClosed" : "Pas encore de coordonnées"}
                </span>
              )}
            </Field>
            <Field label="Rendez-vous iClosed">
              {row.iclosedBookingId ? (
                <span className="font-mono text-xs">{row.iclosedBookingId}</span>
              ) : (
                "—"
              )}
            </Field>
            {row.iclosedError && (
              <Field label="Dernière erreur iClosed">
                <span className="break-all text-xs text-[var(--warn-text)]">{row.iclosedError}</span>
              </Field>
            )}
          </dl>
        </Card>

        <Card title="Réponses">
          <dl className="mt-4 grid gap-5">
            {FORM.questions.map((question) => {
              const value = answerToText(question, answers[question.id]);
              return (
                <div key={question.id}>
                  <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    {question.label}
                    {faulty.has(question.id) && (
                      <span className="ml-2 rounded bg-[var(--warn-bg)] px-1.5 py-0.5 normal-case tracking-normal text-[var(--warn-text)]">
                        éliminatoire
                      </span>
                    )}
                  </dt>
                  <dd className="mt-1 text-sm">
                    {value ? (
                      <span className="whitespace-pre-wrap">{value}</span>
                    ) : (
                      <span className="text-[var(--text-muted)]">Pas atteint</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>

        <Card title="Événement Meta">
          <dl className="mt-4 grid gap-4">
            <Field label="Nom de l'événement">
              <span className="font-mono text-xs">{THANKS.metaEventName}</span>
            </Field>
            <Field label="Touche Meta">
              {row.metaTouch ? (
                <span className="font-mono text-xs">{row.metaTouch}</span>
              ) : (
                <span className="text-[var(--text-muted)]">aucune — trafic hors Meta</span>
              )}
            </Field>
            <Field label="Statut">
              {row.metaEventSentAt ? (
                <>✓ Envoyé le {formatLongDate(row.metaEventSentAt)}</>
              ) : (
                <span className="text-[var(--text-muted)]">{metaAbsenceReason(row)}</span>
              )}
            </Field>
            {row.metaEventDetail && row.metaEventSentAt && (
              <Field label="Trace">
                <span className="break-all font-mono text-xs">{row.metaEventDetail}</span>
              </Field>
            )}
          </dl>

          {row.status === "booked" && row.metaTouch && row.reviewVerdict !== "unqualified" && (
            <div className="mt-5">
              <ResendButton leadId={row.id} sent={Boolean(row.metaEventSentAt)} />
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Le renvoi utilise le même identifiant d&apos;événement : Meta le dédoublonne, il
                n&apos;y a aucun risque de compter deux conversions.
              </p>
            </div>
          )}
        </Card>

        {row.reviewVerdict && (
          <Card title="Relecture">
            <dl className="mt-4 grid gap-4">
              <Field label="Verdict">
                {row.reviewVerdict === "qualified" ? (
                  <span className="text-[var(--ok)]">✓ Retenue — l&apos;événement Meta a le droit de partir</span>
                ) : (
                  <span className="text-[var(--warn-text)]">✗ Écartée — aucun événement Meta</span>
                )}
              </Field>
              <Field label="Motif">
                <span className="whitespace-pre-wrap">{row.reviewReason ?? "—"}</span>
              </Field>
              <Field label="Source">
                <span className="font-mono text-xs">{row.reviewSource ?? "—"}</span>
                {row.reviewSource === "garde" && (
                  <span className="ml-2 text-xs text-[var(--text-muted)]">garde déterministe, sans appel au modèle</span>
                )}
                {row.reviewSource === "repli" && (
                  <span className="ml-2 text-xs text-[var(--warn-text)]">la relecture n&apos;a pas abouti — voir les journaux du serveur</span>
                )}
              </Field>
              {row.reviewedAt && <Field label="Relue le">{formatLongDate(row.reviewedAt)}</Field>}
            </dl>
          </Card>
        )}

        <Card title="Provenance">
          <dl className="mt-4 grid gap-4">
            <Field label="Page d'arrivée">
              {row.landingUrl ? (
                <span className="break-all font-mono text-xs">{row.landingUrl}</span>
              ) : (
                "—"
              )}
            </Field>
            {utmEntries.length > 0 ? (
              utmEntries.map(([key, value]) => (
                <Field key={key} label={key}>
                  <span className="break-all font-mono text-xs">{value}</span>
                </Field>
              ))
            ) : (
              <Field label="UTM">—</Field>
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
}
