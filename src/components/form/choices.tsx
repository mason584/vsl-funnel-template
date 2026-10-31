"use client";

import { motion } from "motion/react";
import type { Option, Question } from "@/content/types";
import { asChoice, asMulti, type Answer } from "@/lib/answers";
import styles from "./form.module.css";

/**
 * Les cartes de choix — le cœur de l'ergonomie du questionnaire.
 *
 * Chaque option porte sa lettre de raccourci : on répond au clavier sans
 * jamais toucher la souris, ce qui divise par deux le temps de remplissage
 * sur ordinateur. Sur un choix unique, la sélection avance toute seule après
 * une courte pause — assez pour voir la coche, assez peu pour ne pas attendre.
 *
 * Les cartes entrent en cascade : trente millisecondes d'écart suffisent à
 * faire lire la liste de haut en bas plutôt que d'un bloc.
 */

export const KEYS = "ABCDEFGHIJ".split("");

export function Choices({
  question,
  value,
  onChange,
  onPick,
}: {
  question: Question;
  value: Answer | undefined;
  onChange: (next: Answer) => void;
  /** Choix unique : appelé après la sélection, pour l'avance automatique. */
  onPick?: () => void;
}) {
  const options = question.options ?? [];
  const multiple = question.kind === "multi";

  const single = asChoice(value);
  const multi = asMulti(value);
  const selected = new Set(multiple ? (multi?.choices ?? []) : single ? [single.choice] : []);

  const select = (option: Option) => {
    if (!multiple) {
      // Rechoisir la même option garde sa précision déjà saisie.
      const detail = single?.choice === option.label ? single.detail : undefined;
      onChange({ choice: option.label, detail });
      if (!option.followUp) onPick?.();
      return;
    }

    const choices = new Set(multi?.choices ?? []);
    const details = { ...(multi?.details ?? {}) };
    if (choices.has(option.label)) {
      choices.delete(option.label);
      delete details[option.label];
    } else {
      choices.add(option.label);
    }
    // L'ordre du contenu, jamais celui des clics : la fiche et l'export
    // doivent lister les réponses dans l'ordre où elles ont été posées.
    onChange({
      choices: options.map((o) => o.label).filter((label) => choices.has(label)),
      details,
    });
  };

  const setDetail = (option: Option, detail: string) => {
    if (multiple) {
      onChange({
        choices: multi?.choices ?? [],
        details: { ...(multi?.details ?? {}), [option.label]: detail },
      });
    } else {
      onChange({ choice: option.label, detail });
    }
  };

  const detailFor = (option: Option): string =>
    (multiple ? multi?.details?.[option.label] : single?.detail) ?? "";

  return (
    <div
      className={styles.choices}
      role={multiple ? "group" : "radiogroup"}
      aria-label={question.label}
    >
      {options.map((option, i) => {
        const isSelected = selected.has(option.label);
        return (
          <motion.div
            key={option.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 + i * 0.03, duration: 0.22, ease: "easeOut" }}
          >
            <button
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={isSelected}
              onClick={() => select(option)}
              className={`${styles.choice} ${isSelected ? styles.choiceSelected : ""}`}
            >
              <span className={styles.key} aria-hidden>
                {isSelected ? "✓" : (KEYS[i] ?? "•")}
              </span>
              <span className={styles.choiceText}>{option.label}</span>
            </button>

            {option.followUp && isSelected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={styles.followUp}
              >
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{option.followUp.label}</span>
                  {option.followUp.multiline ? (
                    <textarea
                      className={styles.textarea}
                      placeholder={option.followUp.placeholder}
                      value={detailFor(option)}
                      onChange={(e) => setDetail(option, e.target.value)}
                    />
                  ) : (
                    <input
                      className={styles.input}
                      placeholder={option.followUp.placeholder}
                      value={detailFor(option)}
                      onChange={(e) => setDetail(option, e.target.value)}
                      // Une précision demandée doit recevoir le curseur : sans
                      // ça, on clique l'option et le champ passe inaperçu.
                      autoFocus
                    />
                  )}
                </label>
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
