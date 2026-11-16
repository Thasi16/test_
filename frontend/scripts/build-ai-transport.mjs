import { build } from "esbuild";
await build({
  entryPoints: ["scripts/ai-transport-client.ts"],
  outfile: "public/ai-transport.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  minify: true,
});
