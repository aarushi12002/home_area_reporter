import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function packageExtension({ origin, outputDir }) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || ["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("A production HTTPS origin without a path or credentials is required.");
  const source = resolve(root, "extension");
  const manifest = JSON.parse(readFileSync(resolve(source, "manifest.json"), "utf8"));
  const out = resolve(outputDir || resolve(root, ".local/releases", `home-area-reporter-${manifest.version}`));
  const bundle = resolve(out, "extension");
  if (existsSync(bundle)) throw new Error("Output bundle already exists; choose a new --out directory.");
  mkdirSync(resolve(bundle, "icons"), { recursive: true });
  manifest.host_permissions = [`${url.origin}/*`];
  manifest.content_security_policy.extension_pages = `script-src 'self'; object-src 'self'; frame-src ${url.origin}`;
  manifest.homepage_url = url.origin;
  writeFileSync(resolve(bundle, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  let html = readFileSync(resolve(source, "popup.html"), "utf8");
  const developmentControl = /    <details>[\s\S]*?<label for="origin">[\s\S]*?<\/details>/;
  if (!developmentControl.test(html)) throw new Error("Development origin control not found.");
  html = html.replace(developmentControl, `    <input id="origin" type="hidden" value="${url.origin}" />`)
    .replace('href="http://localhost:3000/privacy"', `href="${url.origin}/privacy"`);
  if (/localhost|127\.0\.0\.1/.test(html)) throw new Error("Release HTML still references localhost.");
  writeFileSync(resolve(bundle, "popup.html"), html);
  for (const file of ["popup.js", "style.css", "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png"])
    copyFileSync(resolve(source, file), resolve(bundle, file));
  const zip = resolve(out, `home-area-reporter-${manifest.version}.zip`);
  execFileSync("python3", ["-c", "import pathlib,sys,zipfile; base=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(base)) for p in sorted(base.rglob('*')) if p.is_file()]; z.close()", bundle, zip]);
  const listing = JSON.parse(readFileSync(resolve(source, "store-listing.json"), "utf8"));
  writeFileSync(resolve(out, "store-listing.json"), JSON.stringify({ ...listing, website: url.origin, privacyUrl: `${url.origin}/privacy` }, null, 2) + "\n");
  return { origin: url.origin, version: manifest.version, bundle, zip };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = Object.fromEntries(process.argv.slice(2).map((arg) => { const index = arg.indexOf("="); return [arg.slice(0, index), arg.slice(index + 1)]; }));
  if (!options["--origin"]) throw new Error("Usage: npm run extension:package -- --origin=https://your-production-host --out=/absolute/release/path");
  console.log(JSON.stringify(packageExtension({ origin: options["--origin"], outputDir: options["--out"] }), null, 2));
}
