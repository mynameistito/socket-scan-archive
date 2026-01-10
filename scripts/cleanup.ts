#!/usr/bin/env bun

import { existsSync, rmSync } from "node:fs";

const TEMP_REPOS_PATH = "./temp-repos";

try {
  if (existsSync(TEMP_REPOS_PATH)) {
    console.log("🧹 Cleaning up ./temp-repos...");
    rmSync(TEMP_REPOS_PATH, { recursive: true, force: true });
    console.log("✅ Cleanup complete\n");
  } else {
    console.log("✅ No cleanup needed (./temp-repos doesn't exist)\n");
  }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("❌ Cleanup failed:", errorMessage);
  process.exit(1);
}
