import { CONSTANTS } from "../utils/constants";
import {
  calculateBackoffDelay,
  removeDirectory,
  sleep,
} from "../utils/helpers";
import type { Logger } from "../utils/logger";

export class GitOperations {
  private readonly workingDir: string;
  private readonly logger: Logger;
  private readonly dryRun: boolean;

  constructor(workingDir: string, logger: Logger, dryRun = false) {
    this.workingDir = workingDir;
    this.logger = logger;
    this.dryRun = dryRun;
  }

  /**
   * Clone a repository to the target path
   * Automatically removes existing directory if it exists
   */
  async clone(url: string, targetPath: string): Promise<void> {
    if (this.dryRun) {
      this.logger.debug(
        `[DRY-RUN] Would execute: git clone ${url} ${targetPath}`
      );
      return;
    }

    this.logger.debug(`Cloning repository: ${url}`);

    // Clean up existing directory to avoid "already exists" errors
    try {
      const dir = Bun.file(targetPath);
      if (await dir.exists()) {
        this.logger.debug(`Removing existing directory: ${targetPath}`);
        await removeDirectory(targetPath);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Failed to clean existing directory: ${err.message}`);
      // Continue anyway, git clone will fail with a clear error
    }

    const command = ["git", "clone", url, targetPath];

    try {
      const proc = Bun.spawn(command, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: CONSTANTS.GIT_CLONE_TIMEOUT_MS,
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(`Git clone failed: ${stderr}`);
      }

      this.logger.debug(`Successfully cloned to ${targetPath}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Clone failed", err);
      throw err;
    }
  }

  /**
   * Stage a specific file for commit
   */
  async stageFile(filePath: string): Promise<void> {
    if (this.dryRun) {
      this.logger.debug(`[DRY-RUN] Would execute: git add ${filePath}`);
      return;
    }

    this.logger.debug(`Staging file: ${filePath}`);
    const command = ["git", "add", filePath];

    try {
      const proc = Bun.spawn(command, {
        cwd: this.workingDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(`Git add failed: ${stderr}`);
      }

      this.logger.debug(`Successfully staged ${filePath}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Stage failed", err);
      throw err;
    }
  }

  /**
   * Create a commit with the specified message
   */
  async commit(message: string): Promise<void> {
    if (this.dryRun) {
      this.logger.debug(`[DRY-RUN] Would execute: git commit -m "${message}"`);
      return;
    }

    this.logger.debug(`Creating commit: ${message}`);
    const command = ["git", "commit", "-m", message];

    try {
      const proc = Bun.spawn(command, {
        cwd: this.workingDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        // Check if nothing to commit (not an error)
        if (
          stderr.includes("nothing to commit") ||
          stderr.includes("no changes added")
        ) {
          this.logger.warn("Nothing to commit - files already staged");
          return;
        }
        throw new Error(`Git commit failed: ${stderr}`);
      }

      const stdout = await new Response(proc.stdout).text();
      this.logger.debug(`Commit created: ${stdout.trim()}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Commit failed", err);
      throw err;
    }
  }

  /**
   * Push changes to remote branch
   */
  async push(
    branch: string = CONSTANTS.DEFAULT_MAIN_BRANCH,
    retries = 0
  ): Promise<void> {
    if (this.dryRun) {
      this.logger.debug(`[DRY-RUN] Would execute: git push origin ${branch}`);
      return;
    }

    this.logger.debug(`Pushing to origin/${branch}`);
    const command = ["git", "push", "origin", branch];

    try {
      const proc = Bun.spawn(command, {
        cwd: this.workingDir,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60_000, // 60 seconds
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(`Git push failed: ${stderr}`);
      }

      const stdout = await new Response(proc.stdout).text();
      this.logger.debug(`Push successful: ${stdout.trim()}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Retry logic for transient failures
      if (retries < CONSTANTS.MAX_RETRIES) {
        const delay = calculateBackoffDelay(retries);
        this.logger.warn(
          `Push failed, retrying in ${delay}ms (attempt ${retries + 1}/${CONSTANTS.MAX_RETRIES})`
        );
        await sleep(delay);
        return this.push(branch, retries + 1);
      }

      this.logger.error("Push failed after retries", err);
      throw err;
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const command = ["git", "rev-parse", "--abbrev-ref", "HEAD"];

    try {
      const proc = Bun.spawn(command, {
        cwd: this.workingDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error("Failed to get current branch");
      }

      const stdout = await new Response(proc.stdout).text();
      const branch = stdout.trim();
      this.logger.debug(`Current branch: ${branch}`);
      return branch;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Get current branch failed", err);
      throw err;
    }
  }

  /**
   * Get the latest commit hash
   */
  async getLatestCommitHash(): Promise<string> {
    const command = ["git", "rev-parse", "--short", "HEAD"];

    try {
      const proc = Bun.spawn(command, {
        cwd: this.workingDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error("Failed to get commit hash");
      }

      const stdout = await new Response(proc.stdout).text();
      const hash = stdout.trim();
      return hash;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Get commit hash failed", err);
      throw err;
    }
  }

  /**
   * Check git status
   */
  async getStatus(): Promise<string> {
    const command = ["git", "status", "--porcelain"];

    try {
      const proc = Bun.spawn(command, {
        cwd: this.workingDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error("Failed to get status");
      }

      const stdout = await new Response(proc.stdout).text();
      return stdout;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Get status failed", err);
      throw err;
    }
  }

  /**
   * Verify that git is configured properly
   */
  async verifyGitConfig(): Promise<boolean> {
    try {
      const command = ["git", "config", "--list"];
      const proc = Bun.spawn(command, {
        cwd: this.workingDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const exitCode = await proc.exited;
      return exitCode === 0;
    } catch {
      return false;
    }
  }
}
