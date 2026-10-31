import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ce dossier vit dans un monorepo qui porte plusieurs lockfiles : on épingle
  // la racine pour que Turbopack résolve depuis ici.
  turbopack: {
    root: path.resolve(__dirname),
  },

  // PGlite (base d'aperçu) embarque du WASM qui casse au bundling : il doit
  // être chargé depuis node_modules au runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
