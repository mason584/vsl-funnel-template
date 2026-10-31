"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  fontHrefs,
  overrideDeclarations,
  type Appearance,
  type ResolvedWordmark,
} from "@/lib/appearance";
import { Wordmark } from "@/components/ui/primitives";
import { removeLogo, resetAppearance, updateAppearance, type ActionResult } from "./actions";

/**
 * Le formulaire d'apparence et son aperçu en direct.
 *
 * L'aperçu recalcule les mêmes surcharges que le serveur, à chaque frappe,
 * avec la même fonction (`overrideDeclarations`) : ce qu'on voit ici est ce
 * que le site servira, pas une approximation.
 *
 * L'objet complet part en JSON dans un champ caché : c'est exactement ce que
 * l'aperçu a validé, et le serveur n'a rien à reconstruire.
 */

type ColorKey = "bg" | "text" | "accent" | "inverse" | "panel";

type Defaults = {
  colors: Record<ColorKey, string>;
  displayFamily: string;
  bodyFamily: string;
  wordmarkText: string;
};

const COLOR_FIELDS: { key: ColorKey; label: string; hint: string }[] = [
  { key: "bg", label: "Fond", hint: "Le fond de toutes les pages." },
  { key: "text", label: "Texte", hint: "Titres et paragraphes. Les gris en dérivent." },
  { key: "accent", label: "Accent", hint: "Boutons, barre de progression, réponse sélectionnée." },
  { key: "inverse", label: "Sombre", hint: "Boutons de navigation du formulaire." },
  { key: "panel", label: "Panneaux", hint: "Cartes de réponse, champs, encadrés." },
];

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

const inputClass =
  "w-full rounded-md border border-[var(--border-input)] bg-[var(--bg)] px-3 py-2 text-sm";
const chipClass =
  "inline-flex items-center rounded-full border border-[var(--border-soft)] px-2.5 py-1 text-xs hover:bg-[var(--panel-accent)]";

function Notice({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={`rounded-md px-4 py-3 text-sm ${
        state.ok ? "bg-[var(--ok-soft)] text-[var(--ok)]" : "bg-[var(--warn-bg)] text-[var(--warn-text)]"
      }`}
    >
      {state.ok ? "✓ " : "✗ "}
      {state.detail}
    </p>
  );
}

/* ── Une couleur : pastille + hexadécimal + retour au défaut ───────────── */

function ColorField({
  label,
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string;
  hint: string;
  value: string | undefined;
  fallback: string;
  onChange: (next: string | undefined) => void;
}) {
  const [text, setText] = useState(value ?? "");

  const commit = (raw: string) => {
    setText(raw);
    const m = raw.trim().match(HEX_RE);
    if (m) onChange(`#${m[1].toLowerCase()}`);
  };

  return (
    <div className="flex items-start gap-3">
      <input
        type="color"
        aria-label={`${label} — pastille`}
        value={value ?? fallback}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
        className="mt-5 h-9 w-9 shrink-0 cursor-pointer rounded-md border border-[var(--border-input)] bg-transparent p-0.5"
      />
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-[var(--text-muted)]">
          {label}
          {value === undefined && <span className="ml-2 opacity-60">par défaut {fallback}</span>}
        </span>
        <input
          value={text}
          onChange={(e) => commit(e.target.value)}
          placeholder={fallback}
          spellCheck={false}
          className={`${inputClass} font-mono`}
        />
        <span className="text-xs text-[var(--text-muted)]">{hint}</span>
      </label>
      {value !== undefined && (
        <button
          type="button"
          className={`${chipClass} mt-5 shrink-0`}
          onClick={() => {
            setText("");
            onChange(undefined);
          }}
        >
          Par défaut
        </button>
      )}
    </div>
  );
}

/* ── Une police : famille + source ─────────────────────────────────────── */

function FontField({
  label,
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string;
  hint: string;
  value: { family: string; google: boolean } | undefined;
  fallback: string;
  onChange: (next: { family: string; google: boolean } | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-[var(--text-muted)]">
            {label}
            {!value && <span className="ml-2 opacity-60">par défaut {fallback}</span>}
          </span>
          <input
            value={value?.family ?? ""}
            onChange={(e) => {
              const family = e.target.value;
              onChange(family.trim() ? { family, google: value?.google ?? true } : undefined);
            }}
            placeholder={fallback}
            className={inputClass}
          />
        </label>
        {value && (
          <button type="button" className={`${chipClass} mb-0.5 shrink-0`} onClick={() => onChange(undefined)}>
            Par défaut
          </button>
        )}
      </div>
      {value && (
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={value.google}
            onChange={(e) => onChange({ ...value, google: e.target.checked })}
            className="size-4 accent-[var(--accent)]"
          />
          Charger depuis Google Fonts
        </label>
      )}
      <span className="text-xs text-[var(--text-muted)]">{hint}</span>
    </div>
  );
}

/* ── L'aperçu : un écran du formulaire, aux couleurs du brouillon ──────── */

function Preview({
  draft,
  wordmark,
}: {
  draft: Appearance;
  wordmark: ResolvedWordmark;
}) {
  const vars = useMemo(() => overrideDeclarations(draft) as React.CSSProperties, [draft]);
  const hrefs = useMemo(() => fontHrefs(draft), [draft]);

  // Les polices Google du brouillon se chargent à la volée, pour que l'aperçu
  // les montre sans attendre l'enregistrement.
  useEffect(() => {
    for (const href of hrefs) {
      if (document.querySelector(`link[href="${href}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }, [hrefs]);

  const choices = [
    { label: "10 – 50 K€ / mois", selected: false },
    { label: "50 – 200 K€ / mois", selected: true },
    { label: "200 – 500 K€ / mois", selected: false },
  ];

  return (
    <div
      style={vars}
      className="overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] text-[var(--text)] shadow-[var(--shadow-strong)]"
    >
      <div className="h-[3px] w-full bg-[var(--border-soft)]">
        <div className="h-full w-[42%] bg-[var(--accent)]" />
      </div>

      <div className="flex items-center justify-between px-6 py-4">
        <Wordmark mark={wordmark} />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Question 2 / 9
        </span>
      </div>

      <div className="px-6 pb-8 pt-4">
        <p
          className="font-display text-[26px] leading-[1.14]"
          style={{ fontWeight: "var(--display-weight)" as never, letterSpacing: "var(--display-tracking)" }}
        >
          Quel est ton chiffre d&apos;affaires mensuel actuel ?
        </p>
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">
          Le chiffre d&apos;affaires de ton activité, pas ton objectif.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {choices.map((c, i) => (
            <div
              key={c.label}
              className={`flex items-center gap-3 rounded-[var(--radius)] border px-4 py-3 text-[14px] ${
                c.selected
                  ? "border-[var(--accent)] bg-[var(--panel-accent)]"
                  : "border-[var(--border-input)] bg-[var(--panel)]"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded border font-mono text-[11px] ${
                  c.selected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--text-on-accent)]"
                    : "border-[var(--border-strong)] bg-[var(--bg)] text-[var(--text-muted)]"
                }`}
              >
                {c.selected ? "✓" : "ABC"[i]}
              </span>
              {c.label}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-[var(--radius)] bg-[var(--accent)] px-5 text-[14px] font-medium text-[var(--text-on-accent)]">
            OK ✓
          </span>
          <span className="text-[12px] text-[var(--text-muted)]">ou appuie sur Entrée ↵</span>
          <span className="ml-auto flex overflow-hidden rounded-[var(--radius)] shadow-[var(--shadow-soft)]">
            <span className="flex h-8 w-8 items-center justify-center bg-[var(--inverse)] text-[var(--text-on-inverse)]">
              ↑
            </span>
            <span className="flex h-8 w-8 items-center justify-center bg-[var(--inverse)] text-[var(--text-on-inverse)]">
              ↓
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Le formulaire ─────────────────────────────────────────────────────── */

export function AppearanceForm({
  initial,
  logoVersion,
  defaults,
  brandName,
}: {
  initial: Appearance;
  logoVersion: number | null;
  defaults: Defaults;
  brandName: string;
}) {
  const [draft, setDraft] = useState<Appearance>(initial);
  const [localLogo, setLocalLogo] = useState<string | null>(null);

  const [saveState, saveAction, saving] = useActionState(updateAppearance, null as ActionResult | null);
  const [resetState, resetAction, resetting] = useActionState(resetAppearance, null as ActionResult | null);
  const [logoState, removeLogoAction, removing] = useActionState(removeLogo, null as ActionResult | null);

  const busy = saving || resetting || removing;
  const notice = saveState ?? resetState ?? logoState;

  const colors = draft.colors ?? {};
  const fonts = draft.fonts ?? {};

  const setColor = (key: ColorKey, next: string | undefined) =>
    setDraft((d) => {
      const c = { ...(d.colors ?? {}) };
      if (next === undefined) delete c[key];
      else c[key] = next;
      return { ...d, colors: c };
    });

  const setFonts = (patch: Partial<NonNullable<Appearance["fonts"]>>) =>
    setDraft((d) => {
      const f = { ...(d.fonts ?? {}), ...patch };
      for (const k of Object.keys(f) as (keyof typeof f)[]) if (f[k] === undefined) delete f[k];
      return { ...d, fonts: f };
    });

  const storedLogo = logoVersion ? `/api/logo?v=${logoVersion}` : null;
  const logoSrc = localLogo ?? storedLogo;

  const previewWordmark: ResolvedWordmark =
    draft.wordmark?.kind === "image" && logoSrc
      ? { kind: "image", src: logoSrc, alt: brandName, height: draft.wordmark.height }
      : { kind: "text", text: draft.wordmark?.kind === "text" ? draft.wordmark.text : defaults.wordmarkText };

  return (
    <form action={saveAction} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name="appearance" value={JSON.stringify(draft)} />

      <div className="flex flex-col gap-6">
        {/* ── Couleurs ── */}
        <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
          <h2 className="font-display text-[20px]">Couleurs</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Cinq couleurs suffisent : les gris, les bordures et les ombres se calculent à partir
            d&apos;elles. Un champ vide garde la valeur de la charte.
          </p>
          <div className="mt-5 flex flex-col gap-5">
            {COLOR_FIELDS.map((f) => (
              <ColorField
                key={f.key}
                label={f.label}
                hint={f.hint}
                value={colors[f.key]}
                fallback={defaults.colors[f.key]}
                onChange={(next) => setColor(f.key, next)}
              />
            ))}
          </div>
        </section>

        {/* ── Polices ── */}
        <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
          <h2 className="font-display text-[20px]">Polices</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Le nom exact d&apos;une famille Google Fonts, ou d&apos;une police installée sur les
            appareils. Une police auto-hébergée se déclare dans le code.
          </p>
          <div className="mt-5 flex flex-col gap-5">
            <FontField
              label="Titres"
              hint="Ex. : Playfair Display, Fraunces, Instrument Serif, DM Serif Display."
              value={fonts.display}
              fallback={defaults.displayFamily}
              onChange={(display) => setFonts({ display })}
            />
            <FontField
              label="Texte"
              hint="Ex. : Inter, DM Sans, Manrope, Figtree, Hanken Grotesk."
              value={fonts.body}
              fallback={defaults.bodyFamily}
              onChange={(body) => setFonts({ body })}
            />
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-muted)]">Graisse des titres</span>
              <select
                value={fonts.displayWeight ?? ""}
                onChange={(e) =>
                  setFonts({
                    displayWeight: e.target.value
                      ? (Number(e.target.value) as 400 | 500 | 600 | 700)
                      : undefined,
                  })
                }
                className={`${inputClass} w-56`}
              >
                <option value="">Par défaut</option>
                <option value="400">Normale (400)</option>
                <option value="500">Moyenne (500)</option>
                <option value="600">Demi-grasse (600)</option>
                <option value="700">Grasse (700)</option>
              </select>
            </label>
          </div>
        </section>

        {/* ── Wordmark ── */}
        <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
          <h2 className="font-display text-[20px]">Logo</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            En haut de chaque page publique et du formulaire.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {(
              [
                { kind: undefined, label: "Par défaut" },
                { kind: "text", label: "Texte" },
                { kind: "image", label: "Image" },
              ] as const
            ).map((opt) => {
              const active = (draft.wordmark?.kind ?? undefined) === opt.kind;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      wordmark:
                        opt.kind === "text"
                          ? { kind: "text", text: d.wordmark?.kind === "text" ? d.wordmark.text : defaults.wordmarkText }
                          : opt.kind === "image"
                            ? { kind: "image", height: d.wordmark?.kind === "image" ? d.wordmark.height : 28 }
                            : undefined,
                    }))
                  }
                  className={
                    active
                      ? "inline-flex items-center rounded-full bg-[var(--inverse)] px-3 py-1.5 text-xs text-[var(--text-on-inverse)]"
                      : chipClass
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {draft.wordmark?.kind === "text" && (
            <label className="mt-4 flex flex-col gap-1">
              <span className="text-xs text-[var(--text-muted)]">Texte du wordmark</span>
              <input
                value={draft.wordmark.text}
                maxLength={40}
                onChange={(e) => setDraft((d) => ({ ...d, wordmark: { kind: "text", text: e.target.value } }))}
                className={inputClass}
              />
            </label>
          )}

          {draft.wordmark?.kind === "image" && (
            <div className="mt-4 flex flex-col gap-4">
              {logoSrc && (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoSrc} alt="" style={{ height: draft.wordmark.height }} className="w-auto" />
                  {storedLogo && !localLogo && (
                    <button type="submit" formAction={removeLogoAction} disabled={busy} className={chipClass}>
                      Retirer le logo
                    </button>
                  )}
                </div>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--text-muted)]">
                  Fichier — SVG, PNG, WebP ou JPEG, 300 Ko au plus
                </span>
                <input
                  type="file"
                  name="logo"
                  accept="image/svg+xml,image/png,image/webp,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setLocalLogo(file ? URL.createObjectURL(file) : null);
                  }}
                  className="text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--text-muted)]">Hauteur affichée (px)</span>
                <input
                  type="number"
                  min={16}
                  max={80}
                  value={draft.wordmark.height}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      wordmark: { kind: "image", height: Math.min(80, Math.max(16, Number(e.target.value) || 28)) },
                    }))
                  }
                  className={`${inputClass} w-28 tabular-nums`}
                />
              </label>
            </div>
          )}
        </section>

        {/* ── Rayons ── */}
        <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6">
          <h2 className="font-display text-[20px]">Angles</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                { value: undefined, label: "Par défaut" },
                { value: "none", label: "Carrés" },
                { value: "soft", label: "Doux" },
                { value: "round", label: "Ronds" },
              ] as const
            ).map((opt) => {
              const active = (draft.radius ?? undefined) === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, radius: opt.value }))}
                  className={
                    active
                      ? "inline-flex items-center rounded-full bg-[var(--inverse)] px-3 py-1.5 text-xs text-[var(--text-on-inverse)]"
                      : chipClass
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Actions ── */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--inverse)] px-5 text-sm text-[var(--text-on-inverse)] disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="submit"
            formAction={resetAction}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--border-input)] px-5 text-sm disabled:opacity-60"
          >
            {resetting ? "Réinitialisation…" : "Revenir à la charte par défaut"}
          </button>
          <a href="/" target="_blank" rel="noreferrer" className="text-sm text-[var(--link)]">
            Voir le site ↗
          </a>
        </div>

        <Notice state={notice} />
      </div>

      {/* ── Aperçu ── */}
      <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="eyebrow mb-3">Aperçu — un écran du formulaire</p>
        <Preview draft={draft} wordmark={previewWordmark} />
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          L&apos;aperçu suit chaque modification avant même l&apos;enregistrement. Il utilise
          exactement le calcul que le site appliquera.
        </p>
      </div>
    </form>
  );
}
