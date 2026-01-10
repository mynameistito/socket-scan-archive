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
   * Configure git user for this repository using global user settings
   * Required before making commits
   */
  async configureUser(): Promise<void> {
    if (this.dryRun) {
      this.logger.debug(
        "[DRY-RUN] Would configure git user from global config"
      );
      return;
    }

    this.logger.debug("Configuring git user from global config");

    try {
      // Get global user.name
      const nameProc = Bun.spawn(["git", "config", "--global", "user.name"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      const nameExitCode = await nameProc.exited;
      const globalName =
        nameExitCode === 0
          ? (await new Response(nameProc.stdout).text()).trim()
          : null;

      // Get global user.email
      const emailProc = Bun.spawn(["git", "config", "--global", "user.email"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      const emailExitCode = await emailProc.exited;
      const globalEmail =
        emailExitCode === 0
          ? (await new Response(emailProc.stdout).text()).trim()
          : null;

      const isMissingName = !globalName;
      const isMissingEmail = !globalEmail;
      if (isMissingName || isMissingEmail) {
        throw new Error(
          "Git user.name and/or user.email not configured globally. Please run: git config --global user.name 'Your Name' && git config --global user.email 'your@email.com'"
        );
      }

      // Set local repo config to use global values
      const setNameProc = Bun.spawn(
        ["git", "config", "user.name", globalName],
        {
          cwd: this.workingDir,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      const setNameExitCode = await setNameProc.exited;
      if (setNameExitCode !== 0) {
        const stderr = await new Response(setNameProc.stderr).text();
        throw new Error(`Failed to set local git user.name: ${stderr}`);
      }

      const setEmailProc = Bun.spawn(
        ["git", "config", "user.email", globalEmail],
        {
          cwd: this.workingDir,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      const setEmailExitCode = await setEmailProc.exited;
      if (setEmailExitCode !== 0) {
        const stderr = await new Response(setEmailProc.stderr).text();
        throw new Error(`Failed to set local git user.email: ${stderr}`);
      }

      this.logger.debug(`Git user configured: ${globalName} <${globalEmail}>`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Configure user failed", err);
      throw err;
    }
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
        // Wait a moment after removal to ensure filesystem is consistent
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to clean existing directory: ${err.message}`);
      throw new Error(
        `Cannot proceed with clone - failed to remove existing directory: ${err.message}`
      );
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
        const stdout = await new Response(proc.stdout).text();
        const output = stderr || stdout;
        throw new Error(`Git clone failed: ${output}`);
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
        const stdout = await new Response(proc.stdout).text();
        const output = stderr || stdout;
        // Check if nothing to commit (not an error)
        if (
          output.includes("nothing to commit") ||
          output.includes("no changes added")
        ) {
          this.logger.warn(
            "Nothing to commit - socket.yml already in repository"
          );
          return;
        }
        throw new Error(`Git commit failed: ${output}`);
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
