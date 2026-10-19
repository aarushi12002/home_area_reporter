import { spawnSync } from "node:child_process";

const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
  encoding: "utf8",
});
if (inside.status !== 0 || inside.stdout.trim() !== "true") {
  console.error("Run this command from inside the repository checkout.");
  process.exit(1);
}

const configured = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  encoding: "utf8",
});
if (configured.status !== 0) {
  console.error(configured.stderr || "Unable to configure the repository hook path.");
  process.exit(configured.status || 1);
}

console.log("Installed repository-local Git hooks from .githooks.");
