import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // creatives/ : un outil Python et un script Node hors de l'app, avec ses sorties.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "creatives/**"]),
  {
    rules: {
      // Un paramètre préfixé d'un souligné est ignoré à dessein : c'est le cas
      // des actions serveur qui partagent la signature (prev, formData) pour
      // se brancher sur un même formulaire sans en lire les champs.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
