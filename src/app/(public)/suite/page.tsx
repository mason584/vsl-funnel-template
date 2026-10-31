import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FORM } from "@/content/form";
import { VisitPing } from "@/components/visit-ping";
import { W } from "@/lib/wording";
import { outcomeFor } from "../actions";

/**
 * La page de sortie — profil hors critères.
 *
 * Aucun événement de conversion n'est tiré ici, et aucun créneau n'est
 * proposé : c'est le point du montage. La page reste honnête — elle dit non
 * sans faire miroiter un appel qui ne viendra pas, et annonce que les
 * réponses sont conservées. Un disqualifié d'aujourd'hui est un client dans
 * un an.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pas encore",
  robots: { index: false, follow: false },
};

export default async function ExitPage({
  searchParams,
}: {
  searchParams: Promise<{ sid?: string }>;
}) {
  const { sid } = await searchParams;
  const outcome = sid ? await outcomeFor(sid) : null;
  if (!outcome) redirect("/");
  // Quelqu'un de qualifié qui tombe ici par erreur a droit à son créneau.
  if (outcome.status === "booked") redirect(`/merci?sid=${encodeURIComponent(sid!)}`);

  const firstName = outcome.firstName ?? "";
  const fill = (text: string) =>
    text.replace(/\{prenom\}/g, firstName).replace(/\s+,/, ",").replace(/\s{2,}/g, " ");

  return (
    <>
      <VisitPing path="/suite" />

      <section className="mx-auto max-w-2xl px-5 pt-20 sm:px-10 sm:pt-28">
        <h1 className="font-display text-[clamp(30px,4.6vw,46px)] leading-[1.08]">
          {fill(FORM.exit.title)}
        </h1>

        <div className="mt-6 flex flex-col gap-4">
          {FORM.exit.body.map((paragraph) => (
            <p key={paragraph} className="text-[17px] leading-relaxed text-[var(--text-secondary)]">
              {fill(paragraph)}
            </p>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          {FORM.exit.cta && (
            <a
              href={FORM.exit.cta.url}
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-6 text-[15px] font-medium text-[var(--text-on-accent)] no-underline"
            >
              {FORM.exit.cta.label}
            </a>
          )}
          <Link href="/" className="inline-flex min-h-11 items-center text-[var(--link)]">
            {W.backToVideo}
          </Link>
        </div>
      </section>
    </>
  );
}
