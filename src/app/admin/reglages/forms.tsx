"use client";

import { useActionState } from "react";
import {
  checkIclosed,
  checkReview,
  sendTestEvent,
  updateIclosedSettings,
  updateLock,
  updateMetaSettings,
  updateReviewSettings,
  type ActionResult,
} from "../actions";

function Notice({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <div
      role="status"
      className={`mt-4 rounded-md px-4 py-3 text-sm ${
        state.ok ? "bg-[var(--ok-soft)] text-[var(--ok)]" : "bg-[var(--warn-bg)] text-[var(--warn-text)]"
      }`}
    >
      <p>
        {state.ok ? "✓ " : "✗ "}
        {state.detail}
      </p>
      {state.lines && state.lines.length > 0 && (
        <ul className="mt-2 list-none space-y-1 p-0 font-mono text-xs text-[var(--text)]">
          {state.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-[var(--border-input)] bg-[var(--bg)] px-3 py-2 text-sm";
const buttonClass =
  "inline-flex min-h-11 items-center rounded-md bg-[var(--inverse)] px-5 text-sm text-[var(--text-on-inverse)] disabled:opacity-60";
const ghostClass =
  "inline-flex min-h-11 items-center rounded-md border border-[var(--border-input)] px-5 text-sm disabled:opacity-60";

/* ── iClosed ─────────────────────────────────────────────────────────────── */

export function IclosedForm({
  keySet,
  keyHint,
  eventId,
  mapped,
  catchAll,
}: {
  keySet: boolean;
  keyHint: string;
  eventId: string;
  mapped: { id: string; iclosed: string }[];
  catchAll: string | null;
}) {
  const [state, action, pending] = useActionState(updateIclosedSettings, null as ActionResult | null);
  const [check, checkAction, checking] = useActionState(checkIclosed, null as ActionResult | null);

  return (
    <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
      <h2 className="font-display text-[20px]">iClosed</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        La clé d&apos;API donne accès à tous les contacts du compte : elle ne quitte jamais le
        serveur et n&apos;est jamais réaffichée. L&apos;identifiant de l&apos;événement est le
        nombre dans l&apos;URL d&apos;édition de l&apos;événement, dans iClosed.
      </p>

      <form action={action}>
        <label className="mt-5 flex flex-col gap-1">
          <span className="text-xs text-[var(--text-muted)]">
            Clé d&apos;API
            {keySet && <span className="ml-2 text-[var(--ok)]">configurée · {keyHint}</span>}
          </span>
          <input
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={keySet ? "Laisser vide pour conserver la clé actuelle" : "iclosed_…"}
            className={inputClass}
          />
        </label>

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs text-[var(--text-muted)]">Identifiant de l&apos;événement</span>
          <input
            name="eventId"
            defaultValue={eventId}
            placeholder="12345"
            inputMode="numeric"
            className={`${inputClass} w-40`}
          />
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
        <Notice state={state} />
      </form>

      <form action={checkAction} className="mt-6 border-t border-[var(--border-soft)] pt-5">
        <h3 className="text-sm font-medium">Vérifier la connexion et le mapping</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Interroge iClosed : la clé répond-elle, l&apos;événement existe-t-il, chaque question
          mappée a-t-elle son champ rattaché à l&apos;événement, des créneaux sont-ils ouverts.
          À lancer après chaque modification du formulaire.
        </p>
        <ul className="mt-3 list-none space-y-1 p-0 font-mono text-xs text-[var(--text-secondary)]">
          {mapped.map((q) => (
            <li key={q.id}>
              {q.id} → {q.iclosed}
            </li>
          ))}
          {catchAll && <li className="text-[var(--text-muted)]">(sans champ) → {catchAll}</li>}
        </ul>
        <button type="submit" disabled={checking} className={`${ghostClass} mt-4`}>
          {checking ? "Vérification…" : "Vérifier"}
        </button>
        <Notice state={check} />
      </form>
    </section>
  );
}

/* ── Le verrou ───────────────────────────────────────────────────────────── */

export function LockForm({ enabled, durationSeconds }: { enabled: boolean; durationSeconds: number }) {
  const [state, action, pending] = useActionState(updateLock, null as ActionResult | null);
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  return (
    <form action={action} className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
      <h2 className="font-display text-[20px]">Verrou de la landing</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Tant que le décompte tourne, le bouton de candidature reste fermé sous la vidéo. Cale la
        durée sur le moment de la VSL où l&apos;offre est posée. S&apos;applique au visiteur
        suivant, sans redéploiement.
      </p>

      <label className="mt-5 flex items-center gap-3 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-4 accent-[var(--accent)]" />
        Activer le décompte
      </label>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Durée</legend>
        <div className="mt-2 flex items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Minutes
            <input type="number" name="minutes" min={0} max={120} defaultValue={minutes} className={`${inputClass} w-24 tabular-nums`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Secondes
            <input type="number" name="seconds" min={0} max={59} defaultValue={seconds} className={`${inputClass} w-24 tabular-nums`} />
          </label>
        </div>
      </fieldset>

      <button type="submit" disabled={pending} className={`${buttonClass} mt-6`}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      <Notice state={state} />
    </form>
  );
}

/* ── Meta ────────────────────────────────────────────────────────────────── */

export function MetaForm({
  pixelId,
  tokenSet,
  tokenHint,
  testEventCode,
  eventName,
}: {
  pixelId: string;
  tokenSet: boolean;
  tokenHint: string;
  testEventCode: string;
  eventName: string;
}) {
  const [state, action, pending] = useActionState(updateMetaSettings, null as ActionResult | null);

  return (
    <form action={action} className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
      <h2 className="font-display text-[20px]">Meta</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Le pixel est public, il vit dans la page. Le token ne quitte jamais le serveur.
        L&apos;événement de conversion s&apos;appelle <code className="font-mono">{eventName}</code>{" "}
        (réglé dans <code>src/content/thanks.ts</code>) : il part à la réservation, et
        seulement si le trafic vient de Meta.
      </p>

      <label className="mt-5 flex flex-col gap-1">
        <span className="text-xs text-[var(--text-muted)]">Identifiant du pixel (dataset)</span>
        <input name="pixelId" defaultValue={pixelId} placeholder="123456789012345" inputMode="numeric" className={inputClass} />
      </label>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-xs text-[var(--text-muted)]">
          Token Conversions API
          {tokenSet && <span className="ml-2 text-[var(--ok)]">configuré · {tokenHint}</span>}
        </span>
        <input
          name="capiToken"
          type="password"
          autoComplete="off"
          placeholder={tokenSet ? "Laisser vide pour conserver le token actuel" : "EAAG…"}
          className={inputClass}
        />
      </label>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-xs text-[var(--text-muted)]">Code d&apos;événement de test (facultatif)</span>
        <input name="testEventCode" defaultValue={testEventCode} placeholder="TEST12345" className={`${inputClass} w-48`} />
        <span className="text-xs text-[var(--text-muted)]">
          Tant qu&apos;il est renseigné, <strong>tous</strong> les événements partent en test et ne
          comptent nulle part. À vider avant de lancer les campagnes.
        </span>
      </label>

      <button type="submit" disabled={pending} className={`${buttonClass} mt-6`}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      <Notice state={state} />
    </form>
  );
}

/* ── La relecture IA ─────────────────────────────────────────────────────── */

export function ReviewForm({
  enabled,
  keySet,
  keyHint,
  criteria,
  eventName,
}: {
  enabled: boolean;
  keySet: boolean;
  keyHint: string;
  criteria: string;
  eventName: string;
}) {
  const [state, action, pending] = useActionState(updateReviewSettings, null as ActionResult | null);
  const [check, checkAction, checking] = useActionState(checkReview, null as ActionResult | null);

  return (
    <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
      <h2 className="font-display text-[20px]">Relecture IA — pixel conditioning</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Facultatif. Quand elle est active, chaque réservation venue de Meta est relue par un
        modèle d&apos;Anthropic avant que <code className="font-mono">{eventName}</code> ne
        parte : seules les candidatures qui correspondent au profil recherché, et qui ont
        l&apos;air sincères, remontent. Meta apprend alors à ramener ces profils-là, pas tous
        ceux qui prennent rendez-vous. Le rendez-vous, lui, est pris dans tous les cas ; le
        verdict et son motif se lisent sur la fiche du lead. Les coordonnées ne sont jamais
        envoyées au modèle, seulement les réponses.
      </p>

      <form action={action}>
        <label className="mt-5 flex items-center gap-3 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-4 accent-[var(--accent)]" />
          Relire chaque réservation venue de Meta
        </label>

        <label className="mt-5 flex flex-col gap-1">
          <span className="text-xs text-[var(--text-muted)]">
            Clé d&apos;API Anthropic
            {keySet && <span className="ml-2 text-[var(--ok)]">configurée · {keyHint}</span>}
          </span>
          <input
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={keySet ? "Laisser vide pour conserver la clé actuelle" : "sk-ant-…"}
            className={inputClass}
          />
          <span className="text-xs text-[var(--text-muted)]">
            console.anthropic.com → API keys. La clé ne quitte jamais le serveur. Une
            relecture coûte de l&apos;ordre d&apos;un centime.
          </span>
        </label>

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs text-[var(--text-muted)]">Le profil recherché, dans vos mots</span>
          <textarea
            name="criteria"
            defaultValue={criteria}
            rows={7}
            placeholder={
              "Qui on veut en appel, et qui on ne veut pas. Par exemple :\n" +
              "Patron d'une entreprise du bâtiment qui tourne déjà (au moins 100 000 € par an), qui veut plus de demandes ou qui ploie sous la charge. Pas un salarié, pas un étudiant, pas quelqu'un qui cherche un emploi ou une formation. Pas une agence ou un prestataire qui veut nous vendre quelque chose."
            }
            className={`${inputClass} min-h-32 leading-relaxed`}
          />
          <span className="text-xs text-[var(--text-muted)]">
            C&apos;est ce que le modèle lit en premier. Dites qui vous voulez en appel et qui
            vous ne voulez pas, comme vous le diriez à un nouveau setter. Dans le doute, le
            modèle laisse passer : un bon profil écarté coûte plus cher qu&apos;un profil moyen
            compté.
          </span>
        </label>

        <button type="submit" disabled={pending} className={`${buttonClass} mt-6`}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <Notice state={state} />
      </form>

      <form action={checkAction} className="mt-6 border-t border-[var(--border-soft)] pt-5">
        <h3 className="text-sm font-medium">Tester la relecture</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Relit une candidature d&apos;exemple avec la clé et les critères enregistrés. Rien
          n&apos;est envoyé à Meta, aucun lead n&apos;est touché. Pour tester tout le tunnel
          sans polluer Meta : écrire « test » dans le nom ou l&apos;email, la garde coupe
          l&apos;événement quel que soit le verdict du modèle.
        </p>
        <button type="submit" disabled={checking} className={`${ghostClass} mt-4`}>
          {checking ? "Relecture…" : "Tester"}
        </button>
        <Notice state={check} />
      </form>
    </section>
  );
}

export function TestForm({ eventName }: { eventName: string }) {
  const [state, action, pending] = useActionState(sendTestEvent, null as ActionResult | null);

  return (
    <form action={action} className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
      <h2 className="font-display text-[20px]">Événement de test</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Envoie un <code className="font-mono">{eventName}</code> factice par la Conversions API,
        depuis le serveur. Avec un code de test, il s&apos;affiche dans Events Manager en quelques
        secondes sans compter nulle part. Sans code, il entre dans le vrai pipeline.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-muted)]">Code de test (facultatif)</span>
          <input name="testEventCode" placeholder="TEST12345" className={`${inputClass} w-40`} />
        </label>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Envoi…" : "Envoyer un test"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}
