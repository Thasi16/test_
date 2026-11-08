import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../../", import.meta.url);
const json = async (path) =>
  JSON.parse(await readFile(new URL(path, root), "utf8"));
test("all source translations are preserved, including VI/EN motion controls", async () => {
  const modules = (
    await readdir(new URL("modules/", root), { withFileTypes: true })
  ).filter(
    (entry) =>
      entry.isDirectory() &&
      !entry.name.startsWith(".") &&
      !entry.name.startsWith("_"),
  );
  const generated = {};
  for (const locale of ["vi", "en"]) {
    const expected = await json(`locales/${locale}.json`);
    for (const folder of [
      "app_shell",
      ...modules.map((entry) => `modules/${entry.name}`),
    ])
      Object.assign(expected, await json(`${folder}/locales/${locale}.json`));
    generated[locale] = await json(`frontend/src/locales/${locale}.json`);
    assert.deepEqual(generated[locale], expected);
    assert.ok(
      Object.values(expected).every(
        (value) => typeof value === "string" && value.trim(),
      ),
    );
  }
  assert.deepEqual(
    Object.keys(generated.vi).sort(),
    Object.keys(generated.en).sort(),
  );
  assert.ok(Object.keys(generated.vi).length >= 501);
});
test("logo and mascot are identical to the original assets", async () => {
  for (const name of ["logo-horizontal.png", "mascot.png"]) {
    const digest = async (path) =>
      createHash("sha256")
        .update(await readFile(new URL(path, root)))
        .digest("hex");
    assert.equal(
      await digest(`frontend/public/assets/${name}`),
      await digest(`static/assets/${name}`),
    );
  }
});
