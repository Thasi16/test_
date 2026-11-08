import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontend = fileURLToPath(new URL("../", import.meta.url));
const root = path.resolve(frontend, "..");
const modules = (
  await readdir(path.join(root, "modules"), { withFileTypes: true })
)
  .filter(
    (entry) =>
      entry.isDirectory() &&
      !entry.name.startsWith(".") &&
      !entry.name.startsWith("_"),
  )
  .map((entry) => entry.name)
  .sort();
const dictionaries = {};
for (const locale of ["vi", "en"]) {
  const result = JSON.parse(
    await readFile(path.join(root, "locales", `${locale}.json`), "utf8"),
  );
  for (const folder of [
    "app_shell",
    ...modules.map((name) => `modules/${name}`),
  ]) {
    const entries = JSON.parse(
      await readFile(
        path.join(root, folder, "locales", `${locale}.json`),
        "utf8",
      ),
    );
    for (const [key, value] of Object.entries(entries)) {
      if (key in result) throw new Error(`Duplicate translation ${key}`);
      result[key] = value;
    }
  }
  dictionaries[locale] = result;
}
if (
  JSON.stringify(Object.keys(dictionaries.vi).sort()) !==
  JSON.stringify(Object.keys(dictionaries.en).sort())
) {
  throw new Error("VI/EN key mismatch");
}
for (const locale of ["vi", "en"]) {
  if (
    Object.values(dictionaries[locale]).some(
      (value) => typeof value !== "string" || !value.trim(),
    )
  )
    throw new Error("Invalid translation");
  const target = path.join(frontend, "src/locales");
  await mkdir(target, { recursive: true });
  await writeFile(
    path.join(target, `${locale}.json`),
    JSON.stringify(dictionaries[locale], null, 2) + "\n",
  );
}
await mkdir(path.join(frontend, "public/assets"), { recursive: true });
for (const name of ["logo-horizontal.png", "mascot.png"]) {
  await copyFile(
    path.join(root, "static/assets", name),
    path.join(frontend, "public/assets", name),
  );
}
console.log(
  `Synced ${Object.keys(dictionaries.vi).length} original keys per locale and unchanged brand assets.`,
);
