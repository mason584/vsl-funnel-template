import type { Form } from "@/content/types";
import { answerToText, type Answers } from "@/lib/answers";
import type { FieldAnswer } from "@/lib/iclosed";

/**
 * Range les réponses du formulaire dans les champs que l'événement iClosed
 * accepte réellement.
 *
 * Une question mappée (`iclosed`) dont le champ est rattaché à l'événement
 * part seule dans son champ. Toute autre réponse — question sans mapping, ou
 * champ non rattaché — part regroupée, question et réponse, dans le champ
 * fourre-tout du formulaire (`iclosedCatchAll`), s'il est rattaché. Le tri se
 * fait sur ce que l'événement déclare **au moment de l'envoi** : rattacher un
 * champ dans iClosed suffit pour que sa réponse y aille seule dès le prochain
 * lead, sans redéploiement.
 *
 * L'identité (nom, email, téléphone) n'est jamais une réponse : elle vit dans
 * le contact.
 */
export function buildFieldAnswers(form: Form, attached: Set<string>, answers: Answers): FieldAnswer[] {
  const placed: FieldAnswer[] = [];
  const unplaced: string[] = [];

  for (const question of form.questions) {
    if (["name", "email", "phone"].includes(question.kind)) continue;
    const value = answerToText(question, answers[question.id]).trim();
    if (!value) continue;

    if (question.iclosed && attached.has(question.iclosed)) {
      placed.push({ identifier: question.iclosed, value });
    } else {
      unplaced.push(`${question.label}\n${value}`);
    }
  }

  if (unplaced.length > 0) {
    const catchAll = form.iclosedCatchAll;
    if (catchAll && attached.has(catchAll)) {
      placed.push({ identifier: catchAll, value: unplaced.join("\n\n") });
    } else {
      // Plus aucun endroit où les mettre : elles restent sur la fiche de
      // l'administration. Loggé pour que ça se voie dans les journaux.
      console.error(
        `${unplaced.length} réponse(s) sans champ sur l'événement iClosed — vérifier le mapping dans Réglages → iClosed`
      );
    }
  }

  return placed;
}
