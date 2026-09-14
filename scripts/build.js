#!/usr/bin/env node

const { spawnSync } = require("child_process");

const isWindows = process.platform === "win32";

const result = spawnSync(
  isWindows ? "npx.cmd" : "npx",
  ["next", "build", "--webpack"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SKIP_DB_MIGRATIONS: "1",
    },
  }
);

process.exit(result.status ?? 1);