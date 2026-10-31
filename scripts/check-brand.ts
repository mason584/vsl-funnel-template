/**
 * Vérification de l'étanchéité de la couche de marque.
 *
 *   pnpm check:brand        (lancé aussi avant chaque build)
 *
 * Refuse toute teinte écrite en dur — `#rrggbb`, `rgb()`, `hsl()` — hors de
 * `src/brand/`. La promesse faite au client est qu'un rebranding tient dans
 * deux fichiers et un dossier d'images ; une couleur oubliée dans un composant
 * la rend fausse sans que personne ne s'en aperçoive avant la charte sombre
 * du prochain client.
 *
 * `src/lib/appearance.ts` est la seule exception : il calcule des couleurs à
 * partir de celles de la marque, et a besoin du noir et du blanc pour ça.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");
const ALLOWED = [join(ROOT, "brand"), join(ROOT, "lib", "appearance.ts")];
const EXTENSIONS = [".ts", ".tsx", ".css"];

// Une teinte hexadécimale complète (3, 4, 6 ou 8 chiffres), pas une ancre
// d'URL comme « #postes » ni un identifiant comme « #admin-contenu ».
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
const FUNC = /\b(?:rgba?|hsla?|oklch|oklab)\(/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((ext) => full.endsWith(ext))) out.push(full);
  }
  return out;
}

const offenders: string[] = [];

for (const file of walk(ROOT)) {
  if (ALLOWED.some((a) => file === a || file.startsWith(a + "/"))) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const hits = [...line.matchAll(HEX), ...line.matchAll(FUNC)];
    if (hits.length > 0) {
      offenders.push(`  ${relative(process.cwd(), file)}:${i + 1}  ${line.trim().slice(0, 90)}`);
    }
  });
}

if (offenders.length > 0) {
  console.error("✗ Couleurs écrites en dur hors de src/brand/ :");
  console.error(offenders.join("\n"));
  console.error("\n  Passe par une variable de src/brand/tokens.css.");
  process.exit(1);
}

console.log("✓ Aucune couleur en dur hors de la couche de marque.");
