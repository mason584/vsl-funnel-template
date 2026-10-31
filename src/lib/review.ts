import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Form, Question } from "@/content/types";
import { answerToText, asName, asText, type Answers } from "@/lib/answers";
import type { ReviewSettings } from "@/lib/settings";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA RELECTURE — faut-il compter cette réservation comme une conversion ?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Facultative, et faite pour une seule chose : le **pixel conditioning**. Le
 * tunnel laisse réserver tout profil que le verdict (`lib/verdict.ts`) ne
 * rejette pas ; mais toutes les réservations ne se valent pas aux yeux de
 * l'algorithme de Meta. Un remplissage copié-collé, un test, un profil hors
 * cible qui a coché la bonne case : chacun compte comme une conversion, et
 * Meta apprend à ramener le même. La relecture lit la candidature **après la
 * réservation** et dit si l'événement a le droit de partir. Le rendez-vous,
 * lui, est pris de toute façon : bloquer apprend aux gens à écrire un
 * mensonge crédible, et le closer peut annuler depuis iClosed.
 *
 * Trois sources de verdict, dans cet ordre :
 *  1. les **gardes déterministes** — identité de test, même réponse collée
 *     sur plusieurs questions. Instantanées, sans clé d'API, elles
 *     court-circuitent l'appel ;
 *  2. le **modèle**, nourri des critères écrits par l'équipe dans
 *     `/admin/reglages` et des réponses, sans aucune coordonnée ;
 *  3. le **repli** : clé absente, API injoignable, réponse illisible ou
 *     refusée — la candidature passe, le motif le dit, et le journal du
 *     serveur aussi. Un repli silencieux est la panne la plus coûteuse de ce
 *     montage : on croit conditionner le pixel et on ne conditionne rien.
 *
 * Deux leçons apprises sur un autre tunnel, à ne pas réapprendre :
 *  · **la réflexion du modèle compte dans `max_tokens`**. Un plafond de 300
 *    rendait un JSON vide deux fois sur trois, et le repli passait tout en
 *    « sincère » jusqu'à Meta. Le plafond est large, ne pas le redescendre ;
 *  · un 200 ne prouve rien : on relit `stop_reason` et on valide le JSON.
 */

/**
 * Le modèle. Une classification binaire sur quelques centaines de mots :
 * l'effort bas suffit, et le coût par candidature se compte en centimes.
 */
export const REVIEW_MODEL = "claude-opus-5-5";

export type ReviewOutcome = {
  /** Vrai : l'événement Meta a le droit de partir. */
  qualified: boolean;
  /** Une phrase, en français, lisible par l'équipe sur la fiche du lead. */
  reason: string;
  /** D'où vient le verdict : l'identifiant du modèle, `garde` ou `repli`. */
  source: string;
};

const Verdict = z.object({
  qualified: z.boolean(),
  reason: z.string().min(1).max(300),
});

/* ── Les gardes ─────────────────────────────────────────────────────────── */

const TEST_WORD = /(^|[^a-z])test(s|ing)?([^a-z]|$)/i;
const THROWAWAY_DOMAINS = ["yopmail.", "mailinator.", "example.com", "exemple.com", "guerrillamail.", "temp-mail.", "trashmail."];

export type ReviewIdentity = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

/**
 * Une identité de test : « test » dans le nom ou l'adresse, ou un domaine
 * jetable. C'est aussi la façon de **tester le tunnel sans polluer Meta** :
 * écrire « test » dans le nom coupe l'événement, quel que soit l'état de l'IA.
 */
export function isTestIdentity(identity: ReviewIdentity): boolean {
  const name = `${identity.firstName ?? ""} ${identity.lastName ?? ""}`;
  const email = (identity.email ?? "").toLowerCase();
  if (TEST_WORD.test(name)) return true;
  if (TEST_WORD.test(email.split("@")[0] ?? "")) return true;
  return THROWAWAY_DOMAINS.some((domain) => email.includes(domain));
}

/** Les réponses libres, telles que lues par la relecture — jamais les coordonnées. */
function reviewable(form: Form): Question[] {
  return form.questions.filter((q) => !["name", "email", "phone"].includes(q.kind));
}

/**
 * La même réponse libre collée sur plusieurs questions : le signe le plus
 * sûr d'un remplissage au hasard, et celui que les filtres par question ne
 * voient pas, puisque chaque réponse prise seule a l'air d'une phrase.
 */
export function hasRepeatedText(form: Form, answers: Answers): boolean {
  const seen = new Set<string>();
  for (const question of reviewable(form)) {
    if (question.kind !== "short" && question.kind !== "long") continue;
    const text = asText(answers[question.id]).trim().toLowerCase().replace(/\s+/g, " ");
    if (text.length < 4) continue;
    if (seen.has(text)) return true;
    seen.add(text);
  }
  return false;
}

function guard(form: Form, answers: Answers, identity: ReviewIdentity): ReviewOutcome | null {
  if (isTestIdentity(identity)) {
    return { qualified: false, reason: "Identité de test (« test » dans le nom ou l'email, ou domaine jetable).", source: "garde" };
  }
  if (hasRepeatedText(form, answers)) {
    return { qualified: false, reason: "La même réponse est collée sur plusieurs questions.", source: "garde" };
  }
  return null;
}

/* ── Le prompt ──────────────────────────────────────────────────────────── */

/**
 * Le préfixe stable — rôle, critères, questions — vient en premier et se met
 * en cache ; les réponses, qui changent à chaque candidature, viennent dans
 * le message.
 */
function systemPrompt(form: Form, criteria: string): string {
  const questions = reviewable(form)
    .map((q, i) => {
      const options = q.options?.map((o) => `« ${o.label} »`).join(", ");
      return `${i + 1}. ${q.label}${options ? ` (choix : ${options})` : ""}`;
    })
    .join("\n");

  return [
    "Tu relis les candidatures reçues par un formulaire de prise de rendez-vous, juste après la réservation. Tu ne décides pas du rendez-vous — il est pris. Tu décides si cette candidature doit être comptée comme une conversion de qualité auprès de la régie publicitaire, qui apprendra à ramener des profils semblables.",
    "",
    "Une candidature compte si deux choses sont vraies à la fois :",
    "- elle correspond au profil recherché, décrit ci-dessous par l'équipe ;",
    "- elle est sincère : écrite par une vraie personne qui répond vraiment aux questions, pas un remplissage au hasard, un test, une blague ou un texte collé.",
    "",
    "Le profil recherché, dans les mots de l'équipe :",
    "<criteres>",
    criteria.trim(),
    "</criteres>",
    "",
    "Les questions posées, dans l'ordre :",
    questions,
    "",
    "Règles :",
    "- Juge sur le fond. Une réponse courte mais sincère vaut une réponse longue ; l'orthographe, le style et le registre ne comptent pas.",
    "- Écarte une candidature seulement si tu peux dire en une phrase pourquoi elle sort du profil, ou pourquoi elle n'est pas sincère. Dans le doute, elle passe : un bon profil écarté coûte plus cher qu'un profil moyen compté.",
    "- Le motif est lu par l'équipe commerciale : une phrase en français, concrète, 200 caractères au plus, sans reformuler toute la candidature.",
  ].join("\n");
}

function userMessage(form: Form, answers: Answers): string {
  const lines = reviewable(form).map((q) => {
    const text = answerToText(q, answers[q.id]);
    return `${q.label}\n→ ${text || "(pas de réponse)"}`;
  });
  return `La candidature :\n\n${lines.join("\n\n")}`;
}

/* ── L'appel ────────────────────────────────────────────────────────────── */

export type ReviewInput = {
  form: Form;
  answers: Answers;
  identity: ReviewIdentity;
  settings: ReviewSettings;
};

/** Le repli : la candidature passe, mais le motif et le journal disent pourquoi. */
function fallback(why: string): ReviewOutcome {
  console.error("Relecture en repli — l'événement Meta partira sans relecture :", why);
  return { qualified: true, reason: `Relecture indisponible (${why}) : gardes déterministes seulement.`, source: "repli" };
}

/**
 * Relit une candidature. Ne lève jamais : la réservation est déjà prise, et
 * un incident ici ne doit ni la casser ni bloquer l'écran suivant.
 */
export async function reviewApplication(input: ReviewInput): Promise<ReviewOutcome> {
  const { form, answers, identity, settings } = input;

  const guarded = guard(form, answers, identity);
  if (guarded) return guarded;

  if (!settings.apiKey) return fallback("clé Anthropic absente");
  if (!settings.criteria.trim()) return fallback("aucun critère rédigé dans les réglages");

  const client = new Anthropic({ apiKey: settings.apiKey });

  try {
    const response = await client.beta.messages.parse(
      {
        model: REVIEW_MODEL,
        // Large à dessein : la réflexion du modèle compte dans ce plafond.
        max_tokens: 4000,
        system: [{ type: "text", text: systemPrompt(form, settings.criteria), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMessage(form, answers) }],
        output_config: { effort: "low", format: zodOutputFormat(Verdict) },
        // Si un classificateur de sécurité décline la requête, l'API la rejoue
        // sur un modèle de repli dans le même appel.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      // Le visiteur attend cette réponse avant l'écran suivant : on ne
      // s'éternise pas, le repli est écrit pour ça.
      { timeout: 25_000, maxRetries: 1 }
    );

    if (response.stop_reason === "refusal") return fallback("requête déclinée par le modèle");
    if (response.stop_reason === "max_tokens") return fallback("réponse tronquée — plafond de tokens atteint");

    const parsed = response.parsed_output;
    if (!parsed) return fallback("réponse du modèle illisible");

    return { qualified: parsed.qualified, reason: parsed.reason.trim().slice(0, 300), source: response.model };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return fallback("clé Anthropic refusée");
    if (error instanceof Anthropic.RateLimitError) return fallback("quota Anthropic atteint");
    if (error instanceof Anthropic.APIConnectionTimeoutError) return fallback("délai dépassé");
    if (error instanceof Anthropic.APIError) return fallback(`erreur API ${error.status ?? ""} ${error.message}`.trim().slice(0, 200));
    return fallback(String(error).slice(0, 200));
  }
}

/**
 * Une candidature d'exemple, pour vérifier la clé et les critères depuis
 * l'administration sans attendre un vrai visiteur. Chaque question reçoit sa
 * première option ou une phrase plausible.
 */
export function sampleAnswers(form: Form): Answers {
  const answers: Answers = {};
  for (const q of form.questions) {
    switch (q.kind) {
      case "name":
        answers[q.id] = { first: "Camille", last: "Durand" };
        break;
      case "email":
        answers[q.id] = "camille.durand@entreprise.fr";
        break;
      case "phone":
        answers[q.id] = "+33612345678";
        break;
      case "single": {
        const first = q.options?.[0];
        if (first) answers[q.id] = { choice: first.label, ...(first.followUp ? { detail: "précision d'exemple" } : {}) };
        break;
      }
      case "multi": {
        const first = q.options?.[0];
        if (first) answers[q.id] = { choices: [first.label] };
        break;
      }
      case "short":
        answers[q.id] = "Je veux des demandes régulières sans dépendre du bouche-à-oreille.";
        break;
      case "long":
        answers[q.id] = "On tourne bien mais tout repose sur moi : je fais les devis le soir, et quand je ne prospecte pas, le planning se vide deux mois plus tard. Je cherche quelque chose qui tienne sans moi.";
        break;
    }
  }
  return answers;
}

/** Le prénom et le nom de l'exemple, pour la garde d'identité. */
export function sampleIdentity(form: Form, answers: Answers): ReviewIdentity {
  const nameQuestion = form.questions.find((q) => q.kind === "name");
  const name = nameQuestion ? asName(answers[nameQuestion.id]) : null;
  const emailQuestion = form.questions.find((q) => q.kind === "email");
  return {
    firstName: name?.first ?? null,
    lastName: name?.last ?? null,
    email: emailQuestion ? asText(answers[emailQuestion.id]) : null,
  };
}
