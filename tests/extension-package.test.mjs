import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { packageExtension } from "../scripts/package-extension.mjs";

test("release package pins one HTTPS origin and includes only packaged extension files", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "home-area-extension-"));
  const result = packageExtension({ origin: "https://report.example", outputDir });
  const manifest = JSON.parse(readFileSync(join(result.bundle, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.host_permissions, ["https://report.example/*"]);
  assert.match(manifest.content_security_policy.extension_pages, /frame-src https:\/\/report.example$/);
  assert.doesNotMatch(JSON.stringify(manifest), /localhost|127\.0\.0\.1|<all_urls>/);
  const html = readFileSync(join(result.bundle, "popup.html"), "utf8");
  assert.match(html, /id="origin" type="hidden" value="https:\/\/report.example"/);
  assert.doesNotMatch(html, /Website connection|localhost|development build/);
  assert.equal(manifest.version, result.version);
  assert.deepEqual(readdirSync(result.bundle).sort(), ["icons", "manifest.json", "popup.html", "popup.js", "style.css"]);
  const entries = JSON.parse(execFileSync("python3", ["-c", "import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))", result.zip], { encoding: "utf8" }));
  assert.equal(entries.length, 8);
  assert.ok(entries.includes("manifest.json"));
  assert.ok(entries.includes("icons/icon128.png"));
  assert.ok(entries.every((path) => !/\.env|node_modules|source\.svg|store-listing/.test(path)));
  assert.throws(() => packageExtension({ origin: "https://report.example", outputDir }), /already exists/);
  const listing = JSON.parse(readFileSync(join(outputDir, "store-listing.json"), "utf8"));
  assert.equal(listing.privacyUrl, "https://report.example/privacy");
});

test("packager rejects HTTP, paths, embedded credentials and localhost origins", () => {
  for (const origin of ["http://report.example", "https://user:secret@report.example", "https://report.example/path", "https://report.example/?key=value", "https://report.example/#fragment", "https://localhost", "javascript:alert(1)"])
    assert.throws(() => packageExtension({ origin }));
});

test("store icons have the required PNG dimensions", () => {
  for (const size of [16,32,48,128]) {
    const data = readFileSync(new URL(`../extension/icons/icon${size}.png`, import.meta.url));
    assert.equal(data.readUInt32BE(16), size);
    assert.equal(data.readUInt32BE(20), size);
  }
});
