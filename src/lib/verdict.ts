import type { Form } from "@/content/types";
import { isDisqualifying, validateAnswer, type Answers } from "@/lib/answers";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE VERDICT — qualifié ou non.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Calculé **à partir des réponses enregistrées**, jamais d'un drapeau envoyé
 * par le navigateur : c'est lui qui décide si le créneau est proposé, et un
 * formulaire est modifiable par qui le remplit.
 *
 * Deux causes d'élimination, et une seule suffit :
 *  · une option marquée éliminatoire a été choisie ;
 *  · une réponse requise manque ou ne passe pas sa validation — réponse vide,
 *    clavier écrasé, motif répété.
 *
 * La validation est refaite ici sur TOUTES les questions, pas seulement à
 * l'écran. Le formulaire empêche déjà d'avancer sans répondre, mais il tourne
 * dans le navigateur : une requête forgée qui sauterait la question de
 * chiffre d'affaires serait sinon jugée qualifiée et obtiendrait un créneau.
 */

export type Verdict = {
  status: "qualified" | "disqualified";
  /** Les ids des questions fautives — affichés dans l'administration. */
  disqualifiedBy: string[];
};

export function computeVerdict(form: Form, answers: Answers): Verdict {
  const disqualifiedBy: string[] = [];

  for (const question of form.questions) {
    const value = answers[question.id];

    if (isDisqualifying(question, value)) {
      disqualifiedBy.push(question.id);
      continue;
    }

    if (validateAnswer(question, value)) {
      disqualifiedBy.push(question.id);
    }
  }

  return {
    status: disqualifiedBy.length === 0 ? "qualified" : "disqualified",
    disqualifiedBy,
  };
}

/**
 * Faut-il sortir du parcours sur cette question ? Dès qu'une réponse
 * éliminatoire tombe, inutile de faire écrire un paragraphe à quelqu'un à qui
 * on ne proposera pas de créneau.
 */
export function shouldExitNow(form: Form, questionId: string, answers: Answers): boolean {
  const question = form.questions.find((q) => q.id === questionId);
  if (!question) return false;
  return isDisqualifying(question, answers[questionId]);
}
