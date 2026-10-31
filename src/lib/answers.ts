import type { Question } from "@/content/types";
import { looksFake } from "@/lib/quality";
import { W } from "@/lib/wording";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LES RÉPONSES — leur forme, leur validation, leur lecture.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Partagé entre le navigateur (validation à l'écran) et le serveur (verdict,
 * export, administration) : les deux doivent juger une réponse exactement de
 * la même façon, sinon le formulaire accepte ce que le verdict rejette.
 */

export type NameAnswer = { first: string; last: string };
export type ChoiceAnswer = { choice: string; detail?: string };
export type MultiAnswer = { choices: string[]; details?: Record<string, string> };
export type Answer = string | NameAnswer | ChoiceAnswer | MultiAnswer;
export type Answers = Record<string, Answer>;

/* ── Lecture typée ──────────────────────────────────────────────────────── */

export function asName(value: Answer | undefined): NameAnswer | null {
  if (value && typeof value === "object" && "first" in value) return value;
  return null;
}

export function asChoice(value: Answer | undefined): ChoiceAnswer | null {
  if (value && typeof value === "object" && "choice" in value) return value;
  return null;
}

export function asMulti(value: Answer | undefined): MultiAnswer | null {
  if (value && typeof value === "object" && "choices" in value) return value;
  return null;
}

export function asText(value: Answer | undefined): string {
  return typeof value === "string" ? value : "";
}

/** Rend une réponse lisible d'une seule ligne — table, export, fiche. */
export function answerToText(question: Question, value: Answer | undefined): string {
  if (value === undefined) return "";

  switch (question.kind) {
    case "name": {
      const n = asName(value);
      return n ? `${n.first} ${n.last}`.trim() : "";
    }
    case "single": {
      const c = asChoice(value);
      if (!c) return "";
      return c.detail ? `${c.choice} — ${c.detail}` : c.choice;
    }
    case "multi": {
      const m = asMulti(value);
      if (!m) return "";
      return m.choices
        .map((choice) => {
          const detail = m.details?.[choice];
          return detail ? `${choice} — ${detail}` : choice;
        })
        .join(" · ");
    }
    default:
      return asText(value);
  }
}

/* ── Validation d'un écran ──────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Le message d'erreur d'une réponse, ou `null` si elle passe.
 *
 * Le téléphone n'est pas jugé ici : sa validité dépend du pays choisi dans le
 * menu, que seul l'écran connaît (`checkPhone` dans `phone.ts`).
 */
export function validateAnswer(question: Question, value: Answer | undefined): string | null {
  const empty = W.answerNeeded;

  switch (question.kind) {
    case "name": {
      const n = asName(value);
      if (!n || n.first.trim().length < 2) return W.firstName;
      if (n.last.trim().length < 2) return W.lastName;
      return null;
    }

    case "email": {
      const email = asText(value).trim();
      if (!email) return question.required ? W.emailNeeded : null;
      return EMAIL_RE.test(email)
        ? null
        : W.emailInvalid;
    }

    case "phone": {
      const phone = asText(value).trim();
      return phone.length > 0 || !question.required ? null : W.phoneNeeded;
    }

    case "single": {
      const c = asChoice(value);
      if (!c?.choice) return question.required ? W.pickOne : null;
      const option = question.options?.find((o) => o.label === c.choice);
      if (option?.followUp && !(c.detail ?? "").trim()) {
        return `${option.followUp.label} — cette précision est nécessaire.`;
      }
      return null;
    }

    case "multi": {
      const m = asMulti(value);
      const count = m?.choices.length ?? 0;
      const min = question.min ?? (question.required ? 1 : 0);
      if (count < min) {
        return min === 1
          ? W.pickAtLeastOne
          : W.pickAtLeast(min);
      }
      if (question.max && count > question.max) {
        return `Pas plus de ${question.max} réponses.`;
      }
      for (const choice of m?.choices ?? []) {
        const option = question.options?.find((o) => o.label === choice);
        if (option?.followUp && !(m?.details?.[choice] ?? "").trim()) {
          return `${option.followUp.label} — cette précision est nécessaire.`;
        }
      }
      return null;
    }

    case "short":
    case "long": {
      const text = asText(value).trim();
      if (!text) return question.required ? empty : null;
      return looksFake(text, question.minLength ?? 0);
    }
  }
}

/* ── Élimination ────────────────────────────────────────────────────────── */

/** Les options retenues sur une question à choix. */
function chosenOptions(question: Question, value: Answer | undefined) {
  const labels =
    question.kind === "single"
      ? [asChoice(value)?.choice].filter((l): l is string => Boolean(l))
      : question.kind === "multi"
        ? (asMulti(value)?.choices ?? [])
        : [];
  return labels
    .map((label) => question.options?.find((o) => o.label === label))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));
}

/** La question élimine-t-elle, au vu de cette réponse ? */
export function isDisqualifying(question: Question, value: Answer | undefined): boolean {
  return chosenOptions(question, value).some((o) => o.disqualifies === true);
}


