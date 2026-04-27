import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const nodeCmd = process.execPath;
const npxCmd = isWindows ? "npx.cmd" : "npx";
const baselineDir = "prisma/migrations/00000000000000_dev_baseline";
const baselineFile = `${baselineDir}/migration.sql`;

rmSync("prisma/migrations", {
  recursive: true,
  force: true,
});
mkdirSync(baselineDir, {
  recursive: true,
});

run(npxCmd, [
  "prisma",
  "migrate",
  "diff",
  "--from-empty",
  "--to-schema",
  "prisma/schema.prisma",
  "--script",
  "-o",
  baselineFile,
]);

run(nodeCmd, ["scripts/dev-db-reset.mjs"]);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
