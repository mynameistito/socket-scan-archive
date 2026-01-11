#!/usr/bin/env bun

import { GitOperations } from "./git/operations";
import { GitHubClient } from "./github/client";
import { SocketCLIAuth } from "./socket/cli-auth";
import { SocketCLIClient } from "./socket/cli-client";
import type {
  DeletionRecord,
  GitHubRepository,
  OperationResult,
  StepResult,
  SummaryReport,
} from "./types/index";
import { loadConfig, logConfigSummary } from "./utils/config";
import { CONSTANTS } from "./utils/constants";
import {
  clearSocketConfig,
  createSocketYml,
  verifySocketYml,
} from "./utils/file-operations";
import {
  ensureDirectory,
  formatDuration,
  generateLogFilePath,
  parseCliArgs,
  removeDirectory,
} from "./utils/helpers";
import { createLogger } from "./utils/logger";

class RepositorySyncOrchestrator {
  private logger = createLogger("info");
  private gitHub!: GitHubClient;
  private socketCLI!: SocketCLIClient;
  private socketAuth!: SocketCLIAuth;
  private config!: ReturnType<typeof loadConfig>;
  private readonly startTime = new Date();
  private readonly deletionRecords: DeletionRecord[] = [];

  async run(): Promise<void> {
    try {
      // Parse CLI arguments
      const args = process.argv.slice(2);
      const cliArgs = parseCliArgs(args);

      const isDryRun = cliArgs["dry-run"] === true;
      const checkConfig = cliArgs["check-config"] === true;

      // Load and validate configuration
      this.config = loadConfig(isDryRun);

      if (checkConfig) {
        this.logger.info("Configuration check requested");
        logConfigSummary(this.config);
        this.logger.success("Configuration is valid!");
        process.exit(0);
      }

      // Re-initialize logger with proper log level
      this.logger = createLogger(this.config.logLevel);

      // Log startup
      this.logger.info("Starting Repository Sync Orchestrator");
      logConfigSummary(this.config);

      // Initialize clients
      this.logger.debug("Initializing GitHub client...");
      this.gitHub = new GitHubClient(
        this.config.githubToken,
        this.config.githubOrg,
        this.logger
      );

      this.logger.debug("Initializing Socket CLI client...");
      this.socketCLI = new SocketCLIClient(
        this.config.socketApiToken,
        this.config.socketOrg,
        this.logger
      );

      this.logger.debug("Initializing Socket CLI auth...");
      this.socketAuth = new SocketCLIAuth(this.logger);

      // Verify authentication
      this.logger.debug("Verifying authentication...");
      const githubAuthOk = await this.gitHub.verifyAuth();
      if (!githubAuthOk) {
        this.logger.error("GitHub authentication failed");
        process.exit(1);
      }

      // Clear old Socket CLI config to ensure clean authentication
      this.logger.debug("Clearing Socket CLI config...");
      await clearSocketConfig(this.logger);

      // Login to Socket.dev
      this.logger.debug("Logging in to Socket.dev...");
      const socketLoginOk = await this.socketAuth.login(
        this.config.socketApiToken,
        this.config.socketOrg
      );
      if (!socketLoginOk) {
        this.logger.error("Socket.dev login failed");
        process.exit(1);
      }

      // Verify Socket.dev authentication
      this.logger.debug("Verifying Socket.dev authentication...");
      const socketAuthOk = await this.socketCLI.verifyAuthentication();
      if (!socketAuthOk) {
        this.logger.error(
          "Socket.dev authentication verification failed. Please check your API token and organization."
        );
        process.exit(1);
      }

      // Verify organization exists
      const orgOk = await this.gitHub.verifyOrganization();
      if (!orgOk) {
        this.logger.error(`Organization ${this.config.githubOrg} not found`);
        process.exit(1);
      }

      // Ensure logs directory exists
      await ensureDirectory(CONSTANTS.LOG_DIRECTORY);

      // Clean up any leftover temp repos from previous runs
      this.logger.debug(
        `Cleaning up any leftover temp repositories in ${this.config.reposBasePath}...`
      );
      try {
        await removeDirectory(this.config.reposBasePath);
        this.logger.debug(
          `Successfully cleaned up ${this.config.reposBasePath}`
        );
      } catch (error) {
        this.logger.debug(
          `No previous temp directory to clean or cleanup failed (continuing): ${error instanceof Error ? error.message : String(error)}`
        );
      }
      await ensureDirectory(this.config.reposBasePath);

      // Fetch archived repositories
      this.logger.info("Fetching archived repositories...");
      const archivedRepos = await this.gitHub.listArchivedRepositories();

      if (archivedRepos.length === 0) {
        this.logger.info("No archived repositories found");
        process.exit(0);
      }

      this.logger.success(
        `Found ${archivedRepos.length} archived repositories`
      );

      // Process each repository
      const results: OperationResult[] = [];
      for (let index = 0; index < archivedRepos.length; index++) {
        const repo = archivedRepos[index];
        const progress = `[${index + 1}/${archivedRepos.length}]`;
        this.logger.info(`${progress} Processing repository: ${repo.name}`);

        const result = await this.processRepository(repo);
        results.push(result);

        if (result.success) {
          this.logger.success(
            `${progress} Repository completed: ${repo.name} (${formatDuration(result.totalDuration)})`
          );
        } else {
          this.logger.error(
            `${progress} Repository failed: ${repo.name}`,
            result.error,
            { duration: formatDuration(result.totalDuration) }
          );
        }
      }

      // Generate and log summary report
      const report = this.generateSummaryReport(results);
      this.logSummaryReport(report);

      // Save logs to file
      const logPath = generateLogFilePath();
      await this.logger.saveToFile(logPath);

      // Exit with appropriate code
      const allSuccess = results.every((r) => r.success);
      const exitCode = allSuccess ? 0 : 1;
      this.cleanup();
      process.exit(exitCode);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Fatal error in orchestrator", err);
      this.cleanup();
      process.exit(1);
    }
  }

  /**
   * Cleanup Socket.dev authentication
   * @private
   */
  private cleanup(): void {
    const logoutSuccess = this.socketAuth.logout();
    if (!logoutSuccess) {
      this.logger.error("Socket.dev logout failed");
    }
  }

  private async processRepository(
    repo: GitHubRepository
  ): Promise<OperationResult> {
    const operationStartTime = new Date();
    const steps: StepResult[] = [];
    let tempPath = "";
    let deletionFailed = false;

    try {
      tempPath = `${this.config.reposBasePath}/${repo.name}`;

      // Unarchive repository first (only if archived)
      if (repo.archived) {
        await this.executeUnarchiveStep(repo, steps);
      }

      await this.executeCloneStep(repo, tempPath, steps);
      await this.executeFileStep(tempPath, steps);
      await this.executeStageStep(tempPath, steps);
      await this.executeCommitStep(tempPath, steps);

      // Execute delete step - this may fail but should not throw
      // (handles 404 and other non-blocking errors)
      await this.executeDeleteRepositoryStep(repo, steps);
      deletionFailed = steps.some(
        (s) => s.name === "Delete Repository" && !s.success
      );

      // Continue to push even if deletion failed
      await this.executePushStep(tempPath, steps);

      // Rearchive repository after push (only if was originally archived)
      if (repo.archived) {
        await this.executeRearchiveStep(repo, steps);
      }

      return {
        repoName: repo.name,
        success: true,
        steps,
        startTime: operationStartTime,
        endTime: new Date(),
        totalDuration: Date.now() - operationStartTime.getTime(),
      };
    } catch (error) {
      const endTime = new Date();

      // If deletion failed, try to rearchive the repository before returning error
      if (deletionFailed && repo.archived) {
        this.logger.info(
          `Deletion failed for ${repo.name}. Attempting to rearchive...`
        );
        await this.executeRearchiveStep(repo, steps);
      }

      return {
        repoName: repo.name,
        success: false,
        steps,
        error: error instanceof Error ? error : new Error(String(error)),
        startTime: operationStartTime,
        endTime,
        totalDuration: endTime.getTime() - operationStartTime.getTime(),
      };
    } finally {
      if (tempPath && !this.config.dryRun) {
        try {
          await removeDirectory(tempPath);
          this.logger.debug(`Cleaned up temporary directory: ${tempPath}`);
        } catch (error) {
          this.logger.warn(
            `Failed to cleanup temporary directory: ${tempPath}`,
            {
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }
    }
  }

  private async executeUnarchiveStep(
    repo: GitHubRepository,
    steps: StepResult[]
  ): Promise<void> {
    const unarchiveStart = Date.now();
    this.logger.startStep("Unarchive Repository");
    try {
      if (this.config.dryRun) {
        this.logger.debug(`[DRY-RUN] Would unarchive: ${repo.name}`);
        this.logger.endStep(true, "Repository would be unarchived");
        steps.push({
          name: "Unarchive",
          success: true,
          message: "Repository would be unarchived (dry-run)",
          duration: Date.now() - unarchiveStart,
        });
        return;
      }

      const unarchived = await this.gitHub.unarchiveRepository(repo.name);
      if (!unarchived) {
        throw new Error("Failed to unarchive repository");
      }

      this.logger.endStep(true, "Repository unarchived");
      steps.push({
        name: "Unarchive",
        success: true,
        message: "Repository unarchived successfully",
        duration: Date.now() - unarchiveStart,
      });
    } catch (error) {
      this.logger.endStep(false, "Unarchive failed");
      steps.push({
        name: "Unarchive",
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - unarchiveStart,
      });
      throw error;
    }
  }

  private async executeCloneStep(
    repo: GitHubRepository,
    tempPath: string,
    steps: StepResult[]
  ): Promise<void> {
    const cloneStart = Date.now();
    this.logger.startStep("Clone Repository");
    try {
      if (this.config.dryRun) {
        this.logger.debug(
          `[DRY-RUN] Would clone: ${repo.html_url} to ${tempPath}`
        );
      } else {
        const git = new GitOperations(
          tempPath,
          this.logger,
          this.config.dryRun
        );
        await git.clone(repo.html_url, tempPath);
      }
      this.logger.endStep(true, "Repository cloned");
      steps.push({
        name: "Clone",
        success: true,
        message: "Repository cloned",
        duration: Date.now() - cloneStart,
      });
    } catch (error) {
      this.logger.endStep(false, "Clone failed");
      steps.push({
        name: "Clone",
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - cloneStart,
      });
      throw error;
    }
  }

  private async executeFileStep(
    tempPath: string,
    steps: StepResult[]
  ): Promise<void> {
    const fileStart = Date.now();
    this.logger.startStep("Create socket.yml");
    try {
      await createSocketYml(tempPath, this.logger, this.config.dryRun);
      const verified = await verifySocketYml(tempPath, this.logger);
      if (!(verified || this.config.dryRun)) {
        throw new Error("socket.yml verification failed");
      }
      this.logger.endStep(true, "socket.yml created");
      steps.push({
        name: "Create socket.yml",
        success: true,
        message: "socket.yml created and verified",
        duration: Date.now() - fileStart,
      });
    } catch (error) {
      this.logger.endStep(false, "Create socket.yml failed");
      steps.push({
        name: "Create socket.yml",
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - fileStart,
      });
      throw error;
    }
  }

  private async executeStageStep(
    tempPath: string,
    steps: StepResult[]
  ): Promise<void> {
    const stageStart = Date.now();
    this.logger.startStep("Stage file");
    try {
      const git = new GitOperations(tempPath, this.logger, this.config.dryRun);
      await git.stageFile(CONSTANTS.SOCKET_YML_FILENAME);
      this.logger.endStep(true, "File staged");
      steps.push({
        name: "Stage",
        success: true,
        message: "socket.yml staged",
        duration: Date.now() - stageStart,
      });
    } catch (error) {
      this.logger.endStep(false, "Stage failed");
      steps.push({
        name: "Stage",
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - stageStart,
      });
      throw error;
    }
  }

  private async executeCommitStep(
    tempPath: string,
    steps: StepResult[]
  ): Promise<void> {
    const commitStart = Date.now();
    this.logger.startStep("Commit");
    try {
      const git = new GitOperations(tempPath, this.logger, this.config.dryRun);
      // Configure git user before committing
      await git.configureUser();
      await git.commit(CONSTANTS.COMMIT_MESSAGE);
      this.logger.endStep(true, "Committed");
      steps.push({
        name: "Commit",
        success: true,
        message: CONSTANTS.COMMIT_MESSAGE,
        duration: Date.now() - commitStart,
      });
    } catch (error) {
      this.logger.endStep(false, "Commit failed");
      steps.push({
        name: "Commit",
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - commitStart,
      });
      throw error;
    }
  }

  private async executeDeleteRepositoryStep(
    repo: GitHubRepository,
    steps: StepResult[]
  ): Promise<void> {
    const deleteStart = Date.now();
    this.logger.startStep("Delete Socket.dev repository");
    try {
      const result = await this.socketCLI.deleteRepository(
        this.config.socketOrg,
        repo.name,
        this.config.dryRun
      );

      const stepName = "Delete Repository";
      if (result.success) {
        this.logger.endStep(true, result.message);
        steps.push({
          name: stepName,
          success: true,
          message: result.message,
          duration: Date.now() - deleteStart,
        });
        this.deletionRecords.push({
          repoName: repo.name,
          success: true,
          message: result.message,
        });
      } else {
        this.logger.endStep(false, result.message);
        this.logger.warn(
          "Continuing despite repository deletion failure (non-blocking)"
        );
        steps.push({
          name: stepName,
          success: false,
          message: result.message,
          duration: Date.now() - deleteStart,
        });
        this.deletionRecords.push({
          repoName: repo.name,
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.endStep(false, `Exception during deletion: ${message}`);
      this.logger.warn(
        "Continuing despite repository deletion failure (non-blocking)"
      );
      steps.push({
        name: "Delete Repository",
        success: false,
        message: `Exception: ${message}`,
        duration: Date.now() - deleteStart,
      });
      this.deletionRecords.push({
        repoName: repo.name,
        success: false,
        message: `Exception: ${message}`,
      });
      // Do NOT rethrow - this step is non-blocking
    }
  }

  private async executePushStep(
    tempPath: string,
    steps: StepResult[]
  ): Promise<void> {
    const pushStart = Date.now();
    this.logger.startStep("Push to main");
    try {
      const git = new GitOperations(tempPath, this.logger, this.config.dryRun);
      await git.push(CONSTANTS.DEFAULT_MAIN_BRANCH);
      this.logger.endStep(true, "Pushed to origin/main");
      steps.push({
        name: "Push",
        success: true,
        message: `Pushed to origin/${CONSTANTS.DEFAULT_MAIN_BRANCH}`,
        duration: Date.now() - pushStart,
      });
    } catch (error) {
      this.logger.endStep(false, "Push failed");
      steps.push({
        name: "Push",
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - pushStart,
      });
      throw error;
    }
  }

  private async executeRearchiveStep(
    repo: GitHubRepository,
    steps: StepResult[]
  ): Promise<void> {
    const rearchiveStart = Date.now();
    this.logger.startStep("Rearchive Repository");
    try {
      if (this.config.dryRun) {
        this.logger.debug(`[DRY-RUN] Would rearchive: ${repo.name}`);
        this.logger.endStep(true, "Repository would be rearchived");
        steps.push({
          name: "Rearchive",
          success: true,
          message: "Repository would be rearchived (dry-run)",
          duration: Date.now() - rearchiveStart,
        });
        return;
      }

      const rearchived = await this.gitHub.rearchiveRepository(repo.name);
      if (!rearchived) {
        this.logger.warn(
          "Failed to rearchive repository (non-blocking - changes were successfully pushed)"
        );
        steps.push({
          name: "Rearchive",
          success: false,
          message:
            "Failed to rearchive (non-blocking). Check token permissions.",
          duration: Date.now() - rearchiveStart,
        });
        return;
      }

      this.logger.endStep(true, "Repository rearchived");
      steps.push({
        name: "Rearchive",
        success: true,
        message: "Repository rearchived successfully",
        duration: Date.now() - rearchiveStart,
      });
    } catch (error) {
      this.logger.warn(
        "Exception during rearchive (non-blocking - changes were successfully pushed)"
      );
      steps.push({
        name: "Rearchive",
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - rearchiveStart,
      });
    }
  }

  private generateSummaryReport(results: OperationResult[]): SummaryReport {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - this.startTime.getTime();
    const successfulOps = results.filter((r) => r.success).length;
    const failedOps = results.length - successfulOps;

    return {
      totalArchivedRepos: results.length,
      processedRepos: results.length,
      successfulOperations: successfulOps,
      failedOperations: failedOps,
      totalDuration,
      results,
      dryRun: this.config.dryRun,
      startTime: this.startTime,
      endTime,
    };
  }

  private logSummaryReport(report: SummaryReport): void {
    console.log("\n");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("                    SUMMARY REPORT");
    console.log("═══════════════════════════════════════════════════════════");
    if (report.dryRun) {
      console.log("  🔍  MODE: DRY-RUN (no changes made)");
    }
    console.log(
      `  📊  Total Archived Repositories: ${report.totalArchivedRepos}`
    );
    console.log(`  ✅  Successfully Processed: ${report.successfulOperations}`);
    console.log(`  ❌  Failed: ${report.failedOperations}`);
    console.log(
      `  ⏱️   Total Duration: ${formatDuration(report.totalDuration)}`
    );
    console.log("═══════════════════════════════════════════════════════════");

    if (report.failedOperations > 0) {
      console.log("\nFailed Repositories:");
      for (const result of report.results.filter((r) => !r.success)) {
        console.log(`  ❌ ${result.repoName}`);
        if (result.error) {
          console.log(`     Error: ${result.error.message}`);
        }
      }
    }

    // Print archival summary
    this.logArchivalSummary(report);

    // Print deletion summary
    this.logDeletionSummary();

    console.log("\n");
  }

  private logArchivalSummary(report: SummaryReport): void {
    const stats = this.collectArchivalStats(report);

    if (stats.unarchiveSuccesses > 0 || stats.unarchiveFailures > 0) {
      console.log("\n📦 Repository Archival Summary:");
      console.log(`  ✅ Unarchived: ${stats.unarchiveSuccesses}`);
      if (stats.unarchiveFailures > 0) {
        console.log(`  ⚠️  Unarchive failed: ${stats.unarchiveFailures}`);
      }
      console.log(`  ✅ Rearchived: ${stats.rearchiveSuccesses}`);
      if (stats.rearchiveFailures > 0) {
        console.log(
          `  ⚠️  Rearchive failed: ${stats.rearchiveFailures} (non-blocking)`
        );
      }
    }
  }

  private collectArchivalStats(report: SummaryReport): {
    unarchiveSuccesses: number;
    unarchiveFailures: number;
    rearchiveSuccesses: number;
    rearchiveFailures: number;
  } {
    let unarchiveSuccesses = 0;
    let unarchiveFailures = 0;
    let rearchiveSuccesses = 0;
    let rearchiveFailures = 0;

    for (const result of report.results) {
      for (const step of result.steps) {
        if (step.name === "Unarchive") {
          if (step.success) {
            unarchiveSuccesses += 1;
          } else {
            unarchiveFailures += 1;
          }
        } else if (step.name === "Rearchive") {
          if (step.success) {
            rearchiveSuccesses += 1;
          } else {
            rearchiveFailures += 1;
          }
        }
      }
    }

    return {
      unarchiveSuccesses,
      unarchiveFailures,
      rearchiveSuccesses,
      rearchiveFailures,
    };
  }

  private logDeletionSummary(): void {
    if (this.deletionRecords.length === 0) {
      return;
    }

    const successful = this.deletionRecords.filter((r) => r.success).length;
    const failed = this.deletionRecords.length - successful;

    console.log("\n📋 Repository Deletion Summary:");
    console.log(`  ✅ Successfully deleted: ${successful}`);
    if (failed > 0) {
      console.log(`  ⚠️  Failed to delete: ${failed}`);

      for (const record of this.deletionRecords.filter((r) => !r.success)) {
        console.log(`     - ${record.repoName}: ${record.message}`);
      }
    }
  }
}

// Run the orchestrator
const orchestrator = new RepositorySyncOrchestrator();
await orchestrator.run();
