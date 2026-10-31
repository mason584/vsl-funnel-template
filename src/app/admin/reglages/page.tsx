import { BRAND } from "@/brand/brand";
import { FORM } from "@/content/form";
import { THANKS } from "@/content/thanks";
import { requireAdmin } from "@/lib/admin";
import { getIclosedSettings, getLockSettings, getMetaSettings, getReviewSettings, maskToken } from "@/lib/settings";
import { IclosedForm, LockForm, MetaForm, ReviewForm, TestForm } from "./forms";

/**
 * Les réglages — iClosed, Meta et le verrou, saisis ici plutôt qu'en
 * variables d'environnement.
 *
 * Vercel fige les variables au build : « je colle mon pixel et il s'affiche
 * partout » ne peut pas passer par elles. Ce qui est saisi ici s'applique à la
 * page suivante, sans redéploiement.
 */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const [meta, iclosed, lock, review] = await Promise.all([
    getMetaSettings(),
    getIclosedSettings(),
    getLockSettings(),
    getReviewSettings(),
  ]);

  const mapped = FORM.questions.filter((q) => q.iclosed).map((q) => ({ id: q.id, iclosed: q.iclosed as string }));

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-[32px]">Réglages</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Tout ce qui se règle sans redéploiement : la prise de rendez-vous, le tracking, le
        décompte de la landing.
      </p>

      <div className="mt-8 grid gap-6">
        <IclosedForm
          keySet={Boolean(iclosed.apiKey)}
          keyHint={maskToken(iclosed.apiKey)}
          eventId={iclosed.eventId}
          mapped={mapped}
          catchAll={FORM.iclosedCatchAll ?? null}
        />

        <LockForm enabled={lock.enabled} durationSeconds={lock.durationSeconds} />

        <MetaForm
          pixelId={meta.pixelId}
          tokenSet={Boolean(meta.capiToken)}
          tokenHint={maskToken(meta.capiToken)}
          testEventCode={meta.testEventCode}
          eventName={THANKS.metaEventName}
        />

        <TestForm eventName={THANKS.metaEventName} />

        <ReviewForm
          enabled={review.enabled}
          keySet={Boolean(review.apiKey)}
          keyHint={maskToken(review.apiKey)}
          criteria={review.criteria}
          eventName={THANKS.metaEventName}
        />

        <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
          <h2 className="font-display text-[20px]">Ce site</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            {[
              ["Landing", "/"],
              ["Formulaire", "/candidature"],
              ["Remerciement", "/merci"],
              ["Hors critères", "/suite"],
              ["Immersion", "/immersion"],
            ].map(([label, path]) => (
              <div key={path} className="flex flex-wrap justify-between gap-2">
                <dt className="text-[var(--text-muted)]">{label}</dt>
                <dd className="font-mono text-xs">
                  {BRAND.siteUrl}
                  {path === "/" ? "" : path}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Les textes, les vidéos et les questions se modifient dans <code>src/content/</code> ;
            les couleurs et les polices dans <code>/admin/apparence</code> ou{" "}
            <code>src/brand/</code>. Pour re-tester le décompte sur un navigateur déjà
            déverrouillé : <code>/?timer=reset</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
