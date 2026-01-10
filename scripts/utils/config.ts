import { config } from "dotenv";
import type { ScriptConfig } from "../types/index";
import { isValidGitHubToken, isValidOrgName } from "./helpers";

export function loadConfig(isDryRun: boolean): ScriptConfig {
  // Load .env file
  config({ path: ".env" });

  const githubToken = process.env.GITHUB_TOKEN?.trim();
  const socketApiToken = process.env.SOCKET_API_TOKEN?.trim();
  const githubOrg = process.env.GITHUB_ORG?.trim();
  const socketOrg = process.env.SOCKET_ORG?.trim();
  const reposBasePath = process.env.REPOS_BASE_PATH?.trim() || "./temp-repos";
  const socketBaseUrl =
    process.env.SOCKET_BASE_URL?.trim() || "https://api.socket.dev/v0";
  const githubBaseUrl =
    process.env.GITHUB_BASE_URL?.trim() || "https://api.github.com";
  const logLevel =
    (process.env.LOG_LEVEL?.trim() as "debug" | "info" | "warn" | "error") ||
    "info";

  validateConfig({
    githubToken: githubToken || "",
    socketApiToken: socketApiToken || "",
    githubOrg: githubOrg || "",
    socketOrg: socketOrg || "",
    reposBasePath: reposBasePath || "",
    dryRun: isDryRun,
    socketBaseUrl: socketBaseUrl || "",
    githubBaseUrl: githubBaseUrl || "",
    logLevel,
  });

  return {
    githubToken: githubToken || "",
    socketApiToken: socketApiToken || "",
    githubOrg: githubOrg || "",
    socketOrg: socketOrg || "",
    reposBasePath,
    dryRun: isDryRun,
    socketBaseUrl,
    githubBaseUrl,
    logLevel,
  };
}

export function validateConfig(config: ScriptConfig): void {
  const errors: string[] = [];

  // Validate GitHub token
  if (!config.githubToken) {
    errors.push("GITHUB_TOKEN environment variable is required");
  } else if (!isValidGitHubToken(config.githubToken)) {
    console.warn(
      "Warning: GITHUB_TOKEN may not be in the expected format (should start with ghp_, ghs_, or ghu_)"
    );
  }

  // Validate Socket API token
  if (!config.socketApiToken) {
    errors.push("SOCKET_API_TOKEN environment variable is required");
  }

  // Validate GitHub org
  if (!config.githubOrg) {
    errors.push("GITHUB_ORG environment variable is required");
  } else if (!isValidOrgName(config.githubOrg)) {
    errors.push(`Invalid GITHUB_ORG format: ${config.githubOrg}`);
  }

  // Validate Socket org
  if (!config.socketOrg) {
    errors.push("SOCKET_ORG environment variable is required");
  } else if (!isValidOrgName(config.socketOrg)) {
    errors.push(`Invalid SOCKET_ORG format: ${config.socketOrg}`);
  }

  // Validate repos base path
  if (!config.reposBasePath) {
    errors.push("REPOS_BASE_PATH is required");
  }

  // Validate URLs
  try {
    new URL(config.socketBaseUrl);
  } catch {
    errors.push(`Invalid SOCKET_BASE_URL: ${config.socketBaseUrl}`);
  }

  try {
    new URL(config.githubBaseUrl);
  } catch {
    errors.push(`Invalid GITHUB_BASE_URL: ${config.githubBaseUrl}`);
  }

  if (errors.length > 0) {
    console.error("\n❌ Configuration Validation Failed:\n");
    errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error}`);
    });
    console.error(
      "\nPlease create a .env file with required variables. See .env.example for reference.\n"
    );
    process.exit(1);
  }
}

export function logConfigSummary(config: ScriptConfig): void {
  console.log("\n📋 Configuration Summary:");
  console.log(`   GitHub Org: ${config.githubOrg}`);
  console.log(`   Socket.dev Org: ${config.socketOrg}`);
  console.log(`   Repos Path: ${config.reposBasePath}`);
  console.log(`   Dry Run: ${config.dryRun ? "Yes" : "No"}`);
  console.log(`   Log Level: ${config.logLevel}`);
  console.log(`   GitHub API: ${config.githubBaseUrl}`);
  console.log(`   Socket.dev API: ${config.socketBaseUrl}\n`);
}
