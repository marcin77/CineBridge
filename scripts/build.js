#!/usr/bin/env node

const { spawnSync } = require("child_process");

const result = spawnSync("npx next build --webpack", {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    SKIP_DB_MIGRATIONS: "1",
  },
});

if (result.error) {
  console.error("[build] Nie udało się uruchomić next build:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);