import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INITIAL_SERVICE_AREAS } from "../lib/project-pipeline.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const errors = [];
const requireText = (path, text, label = text) => {
  if (!read(path).includes(text)) errors.push(`${path} must mention ${label}`);
};

const setupPath = "docs/fresh-machine-setup.md";
const setup = read(setupPath);
const readme = read("README.md");
const design = read("docs/mvp-setup.md");
const packageJson = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("extension/manifest.json"));

for (const heading of [
  "Prerequisites",
  "Checkout and install",
  "Local PostgreSQL",
  "Schema and initial data",
  "Run the website",
  "Load the Chrome extension",
  "Validate the checkout",
  "Restart and shutdown",
  "Troubleshooting",
  "Codex handoff prompt",
])
  if (!new RegExp(`^## (?:\\d+\\. )?${heading}$`, "m").test(setup))
    errors.push(`${setupPath} is missing the '${heading}' section`);

for (const script of [
  "hooks:install",
  "docs:check",
  "db:migrate",
  "db:ingest",
  "extension:package",
  "dev",
  "test",
  "build",
]) {
  if (!packageJson.scripts?.[script]) errors.push(`package.json is missing script '${script}'`);
  if (!setup.includes(`npm run ${script}`) && script !== "test")
    errors.push(`${setupPath} must document 'npm run ${script}'`);
}
if (!setup.includes("npm test")) errors.push(`${setupPath} must document 'npm test'`);

const envVariables = [...read(".env.example").matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(
  (match) => match[1],
);
for (const variable of envVariables)
  if (!setup.includes(variable)) errors.push(`${setupPath} must document ${variable}`);

for (const zip of INITIAL_SERVICE_AREAS) {
  if (!setup.includes(zip)) errors.push(`${setupPath} must mention supported ZIP ${zip}`);
  if (!design.includes(zip) && !design.includes("98101–98105"))
    errors.push(`docs/mvp-setup.md must cover supported ZIP ${zip}`);
}

if (!setup.includes(`Current extension manifest version: \`${manifest.version}\`.`))
  errors.push(`${setupPath} must record extension manifest version ${manifest.version}`);

for (const route of [
  "/api/area-summary",
  "/api/transit",
  "/api/soundscore",
  "/api/projects",
  "/api/projects/:id",
  "/api/internal/ingest",
  "/map",
  "/report",
  "/privacy",
])
  if (!design.includes(route)) errors.push(`docs/mvp-setup.md must document route ${route}`);

for (const path of ["AGENTS.md", "agents_start.md", "wrapup.md"]) {
  requireText(path, setupPath);
  requireText(path, "npm run docs:check");
}
requireText("README.md", "docs/fresh-machine-setup.md", "the fresh-machine setup guide");
requireText("README.md", "npm run docs:check");
requireText(".github/workflows/ci.yml", "npm run docs:check");
requireText(".githooks/post-commit", "docs:check");
requireText(".githooks/pre-push", "docs:check");

for (const markdownPath of ["README.md", "AGENTS.md", "agents_start.md", "wrapup.md", setupPath]) {
  const markdown = read(markdownPath);
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const raw = match[1].replace(/^<|>$/g, "").split("#")[0];
    if (!raw || /^(?:https?:|mailto:)/.test(raw)) continue;
    const target = resolve(root, dirname(markdownPath), decodeURIComponent(raw));
    if (!existsSync(target)) errors.push(`${markdownPath} contains missing link target ${match[1]}`);
  }
}

if (errors.length) {
  console.error("Documentation/setup consistency check failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Documentation/setup consistency check passed (${envVariables.length} env variables, ${INITIAL_SERVICE_AREAS.length} service areas, extension ${manifest.version}).`,
);
