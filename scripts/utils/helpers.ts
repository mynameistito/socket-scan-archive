import { CONSTANTS } from "./constants";

// Regex patterns for validation
const GIT_HOST_REGEX = /git@([^:]+):/;
const GITHUB_TOKEN_REGEX = /^(ghp_|ghs_|ghu_)[a-zA-Z0-9_]{36,255}$/;
const ORG_NAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$/;

/**
 * Generate timestamped log file path
 */
export function generateLogFilePath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5); // Remove milliseconds
  return `${CONSTANTS.LOG_DIRECTORY}/${CONSTANTS.LOG_FILE_PREFIX}-${timestamp}.log`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(attemptNumber: number): number {
  return Math.min(1000 * 2 ** attemptNumber, 30_000);
}

/**
 * Sanitize repository name for logging
 */
export function sanitizeRepoName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "-");
}

/**
 * Format duration in milliseconds to readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Extract domain from Git URL
 */
export function extractDomainFromGitUrl(url: string): string {
  try {
    // Handle both HTTPS and SSH URLs
    const isSSH = url.startsWith("git@");
    if (isSSH) {
      const match = url.match(GIT_HOST_REGEX);
      return match ? match[1] : "unknown";
    }
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return "unknown";
  }
}

/**
 * Parse CLI arguments
 */
export function parseCliArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("--")) {
        parsed[key] = nextArg;
        i++;
      } else {
        parsed[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      parsed[key] = true;
    }
  }

  return parsed;
}

/**
 * Validate GitHub token format
 */
export function isValidGitHubToken(token: string): boolean {
  // GitHub tokens start with ghp_, ghs_, or ghu_
  return GITHUB_TOKEN_REGEX.test(token);
}

/**
 * Validate organization name format
 */
export function isValidOrgName(name: string): boolean {
  // GitHub org names follow similar rules to usernames
  return ORG_NAME_REGEX.test(name);
}

/**
 * Create directory if it doesn't exist
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    const dir = Bun.file(dirPath);
    if (!(await dir.exists())) {
      // Use the native mkdir API available in Bun
      const { mkdir } = await import("node:fs/promises");
      await mkdir(dirPath, { recursive: true });
    }
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Remove directory recursively
 */
export async function removeDirectory(dirPath: string): Promise<void> {
  try {
    const dir = Bun.file(dirPath);
    if (await dir.exists()) {
      // Use the native rm API available in Bun
      const { rm } = await import("node:fs/promises");
      await rm(dirPath, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Failed to remove directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const file = Bun.file(filePath);
    return await file.exists();
  } catch {
    return false;
  }
}

/**
 * Format current time for display
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Calculate percentage
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
}
