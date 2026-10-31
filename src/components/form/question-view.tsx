"use client";

import { useEffect, useRef, useState } from "react";
import type { Question } from "@/content/types";
import { asName, asText, type Answer } from "@/lib/answers";
import { COUNTRIES } from "@/lib/phone";
import { Choices } from "./choices";
import styles from "./form.module.css";

/**
 * Le rendu d'une question, selon son type.
 *
 * Le focus se pose seul sur le premier champ à chaque écran : sans lui, il
 * faudrait un clic entre chaque question, et tout le bénéfice du clavier
 * disparaîtrait.
 */
export function QuestionView({
  question,
  value,
  error,
  dialCountry,
  onDialCountry,
  onChange,
  onPick,
  onSubmit,
}: {
  question: Question;
  value: Answer | undefined;
  error: string | null;
  dialCountry: string;
  onDialCountry: (iso: string) => void;
  onChange: (next: Answer) => void;
  /** Choix unique : avance automatique après la sélection. */
  onPick: () => void;
  /** Validation au clavier depuis un champ texte. */
  onSubmit: () => void;
}) {
  const first = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const last = useRef<HTMLInputElement>(null);
  /**
   * Écran prénom + nom : le champ « Nom », une fois apparu, ne se cache plus.
   * Mémorisé par id de question : un autre écran repart à zéro sans effet.
   */
  const [lastShownFor, setLastShownFor] = useState<string | null>(null);
  const lastShown = lastShownFor === question.id;
  const setLastShown = (shown: boolean) => setLastShownFor(shown ? question.id : null);

  useEffect(() => {
    // `preventScroll` : sur mobile, le focus fait autrement sauter la page
    // avant même que l'animation d'entrée soit finie.
    first.current?.focus({ preventScroll: true });
  }, [question.id]);

  const enterAdvances = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter") return;
    // Dans un paragraphe, Entrée doit rester un retour à la ligne : c'est
    // Cmd/Ctrl+Entrée qui valide.
    if (question.kind === "long" && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    onSubmit();
  };

  const errorClass = error ? styles.inputError : "";

  switch (question.kind) {
    case "name": {
      const name = asName(value) ?? { first: "", last: "" };
      // Le nom n'apparaît qu'une fois le prénom tapé : un seul champ au
      // départ, c'est un premier écran qui ne demande rien. Une fois montré,
      // il reste — effacer le prénom ne doit pas faire disparaître le nom.
      const showLast = lastShown || name.first.trim().length >= 2 || name.last.length > 0;
      const firstEnter = (event: React.KeyboardEvent) => {
        if (event.key !== "Enter") return;
        // Entrée sur le prénom passe au nom tant qu'il est vide ; c'est
        // Entrée sur le nom qui valide l'écran.
        if (name.first.trim().length >= 2 && name.last.trim().length < 2) {
          event.preventDefault();
          setLastShown(true);
          window.setTimeout(() => last.current?.focus({ preventScroll: true }), 0);
          return;
        }
        enterAdvances(event);
      };
      return (
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Prénom</span>
            <input
              ref={first as React.RefObject<HTMLInputElement>}
              className={`${styles.input} ${errorClass}`}
              value={name.first}
              autoComplete="given-name"
              onChange={(e) => onChange({ ...name, first: e.target.value })}
              onKeyDown={firstEnter}
            />
          </label>
          {showLast && (
            <label
              className={`${styles.field} ${styles.appear}`}
              // Une fois montré, il reste : effacer le prénom ne le cache pas.
              ref={() => {
                if (!lastShown) setLastShown(true);
              }}
            >
              <span className={styles.fieldLabel}>Nom</span>
              <input
                ref={last}
                className={`${styles.input} ${errorClass}`}
                value={name.last}
                autoComplete="family-name"
                onChange={(e) => onChange({ ...name, last: e.target.value })}
                onKeyDown={enterAdvances}
              />
            </label>
          )}
        </div>
      );
    }

    case "phone":
      return (
        <div className={styles.field}>
          <div className={styles.phoneRow}>
            <select
              className={styles.dial}
              aria-label="Indicatif du pays"
              value={dialCountry}
              onChange={(e) => onDialCountry(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {c.flag} {c.dial}
                </option>
              ))}
            </select>
            <input
              ref={first as React.RefObject<HTMLInputElement>}
              type="tel"
              inputMode="tel"
              placeholder={question.placeholder ?? "6 12 34 56 78"}
              className={`${styles.input} ${errorClass}`}
              value={asText(value)}
              autoComplete="tel-national"
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={enterAdvances}
            />
          </div>
        </div>
      );

    case "email":
      return (
        <div className={styles.field}>
          <input
            ref={first as React.RefObject<HTMLInputElement>}
            type="email"
            inputMode="email"
            placeholder={question.placeholder}
            className={`${styles.input} ${errorClass}`}
            value={asText(value)}
            autoComplete="email"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={enterAdvances}
          />
        </div>
      );

    case "short":
      return (
        <div className={styles.field}>
          <input
            ref={first as React.RefObject<HTMLInputElement>}
            placeholder={question.placeholder}
            className={`${styles.input} ${errorClass}`}
            value={asText(value)}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={enterAdvances}
          />
        </div>
      );

    case "long":
      return (
        <div className={styles.field}>
          <textarea
            ref={first as React.RefObject<HTMLTextAreaElement>}
            placeholder={question.placeholder}
            className={`${styles.textarea} ${errorClass}`}
            value={asText(value)}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={enterAdvances}
          />
        </div>
      );

    case "single":
    case "multi":
      return <Choices question={question} value={value} onChange={onChange} onPick={onPick} />;
  }
}
