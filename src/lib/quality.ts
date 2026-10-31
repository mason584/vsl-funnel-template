import { W } from "@/lib/wording";

/**
 * Garde-fou anti-remplissage.
 *
 * Déterministe et instantané — aucun appel réseau, aucune clé d'API. Il tourne
 * dans le navigateur pour refuser un « azerty » avant de laisser passer
 * l'écran, ET côté serveur au calcul du verdict : une réponse ouverte rejetée
 * ici disqualifie le lead.
 *
 * Volontairement étroit : il ne doit jamais recaler quelqu'un qui répond court
 * mais sincèrement. Un prospect bavard n'est pas meilleur qu'un prospect
 * concis, et un faux positif coûte un bon profil.
 */

/**
 * Rangées de clavier, AZERTY compris — le produit est français, et un
 * remplissage au hasard ici ressemble à « azerty » ou « qsdfgh », pas à
 * « asdfgh ». Ancré sur toute la chaîne : un mot réel de plus de douze
 * caractères tiré d'une seule rangée n'existe pratiquement pas.
 */
const KEYBOARD_MASH =
  /^(?:[asdfghjkl]+|[qwertyuiop]+|[zxcvbnm]+|[azertyuiop]+|[qsdfghjklm]+|[wxcvbn]+)$/i;
const FILLER = new Set([
  "test",
  "tests",
  "testing",
  "aaa",
  "abc",
  "abcd",
  "azerty",
  "qwerty",
  "rien",
  "na",
  "n/a",
  "nsp",
  "aucun",
  "aucune",
  "-",
  ".",
  "..",
  "...",
  "?",
  "??",
  "x",
  "xx",
  "xxx",
]);

/**
 * Rejet évident, sans IA. Volontairement étroit : il ne doit jamais recaler
 * quelqu'un qui répond court mais sincèrement.
 */
export function looksFake(value: string, minLength: number): string | null {
  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return W.tooShort;
  }

  const normalised = trimmed.toLowerCase().replace(/[\s.]+$/, "");
  if (FILLER.has(normalised) || KEYBOARD_MASH.test(normalised.replace(/\s/g, ""))) {
    return W.looksFake;
  }

  const compact = normalised.replace(/\s/g, "");

  // Un seul caractère répété.
  if (/^(.)\1+$/.test(compact)) {
    return W.looksFake;
  }

  // Un motif court répété — « azertyazerty », « testtesttest ». C'est ce qui
  // passe le plus facilement à travers les autres filtres, parce que la chaîne
  // est longue et mêle plusieurs rangées de clavier.
  if (isRepeatedUnit(compact)) {
    return W.looksFake;
  }

  return null;
}

/** La chaîne est-elle un motif de huit caractères ou moins, répété tel quel ? */
function isRepeatedUnit(value: string): boolean {
  for (let size = 1; size <= Math.min(8, Math.floor(value.length / 2)); size += 1) {
    if (value.length % size !== 0) continue;
    const unit = value.slice(0, size);
    if (unit.repeat(value.length / size) === value) return true;
  }
  return false;
}
