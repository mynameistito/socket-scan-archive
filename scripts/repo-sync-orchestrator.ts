#!/usr/bin/env bun

import { GitOperations } from "./git/operations";
import { GitHubClient } from "./github/client";
import { SocketClient } from "./socket/client";
import type {
  GitHubRepository,
  OperationResult,
  StepResult,
  SummaryReport,
} from "./types/index";
import { loadConfig, logConfigSummary } from "./utils/config";
import { CONSTANTS } from "./utils/constants";
import { createSocketYml, verifySocketYml } from "./utils/file-operations";
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
  private socket!: SocketClient;
  private config!: ReturnType<typeof loadConfig>;
  private readonly startTime = new Date();

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

      this.logger.debug("Initializing Socket.dev client...");
      this.socket = new SocketClient(
        this.config.socketApiToken,
        this.config.socketBaseUrl,
        this.logger
      );

      // Verify authentication
      this.logger.debug("Verifying authentication...");
      const githubAuthOk = await this.gitHub.verifyAuth();
      if (!githubAuthOk) {
        this.logger.error("GitHub authentication failed");
        process.exit(1);
      }

      const socketAuthOk = await this.socket.verifyAuth();
      if (!socketAuthOk) {
        this.logger.warn(
          "Socket.dev authentication check failed (may not be critical)"
        );
      }

      // Verify organization exists
      const orgOk = await this.gitHub.verifyOrganization();
      if (!orgOk) {
        this.logger.error(`Organization ${this.config.githubOrg} not found`);
        process.exit(1);
      }

      // Ensure logs directory exists
      await ensureDirectory(CONSTANTS.LOG_DIRECTORY);

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
      process.exit(allSuccess ? 0 : 1);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Fatal error in orchestrator", err);
      process.exit(1);
    }
  }

  private async processRepository(
    repo: GitHubRepository
  ): Promise<OperationResult> {
    const operationStartTime = new Date();
    const steps: StepResult[] = [];
    let tempPath = "";

    try {
      tempPath = `${this.config.reposBasePath}/${repo.name}`;

      await this.executeCloneStep(repo, tempPath, steps);
      await this.executeFileStep(tempPath, steps);
      await this.executeStageStep(tempPath, steps);
      await this.executeCommitStep(tempPath, steps);
      const scansCount = await this.executeListScansStep(repo, steps);
      await this.executeDeleteScansStep(repo, scansCount, steps);
      await this.executePushStep(tempPath, steps);

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

  private async executeListScansStep(
    repo: GitHubRepository,
    steps: StepResult[]
  ): Promise<number> {
    const listScansStart = Date.now();
    this.logger.startStep("List Socket.dev scans");
    let scansCount = 0;
    try {
      const scans = await this.socket.listScans(repo.name);
      scansCount = scans.length;
      this.logger.endStep(true, `Found ${scansCount} scans`);
      steps.push({
        name: "List Scans",
        success: true,
        message: `Found ${scansCount} scans`,
        duration: Date.now() - listScansStart,
      });
    } catch (error) {
      this.logger.endStep(false, "List scans failed");
      this.logger.warn("Continuing despite scan listing failure");
      steps.push({
        name: "List Scans",
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - listScansStart,
      });
    }
    return scansCount;
  }

  private async executeDeleteScansStep(
    repo: GitHubRepository,
    scansCount: number,
    steps: StepResult[]
  ): Promise<void> {
    const deleteScansStart = Date.now();
    this.logger.startStep("Delete Socket.dev scans");
    let deletedCount = 0;
    try {
      if (scansCount > 0) {
        deletedCount = await this.socket.deleteAllScans(repo.name);
      }
      this.logger.endStep(true, `Deleted ${deletedCount} scans`);
      steps.push({
        name: "Delete Scans",
        success: true,
        message: `Deleted ${deletedCount} scans`,
        duration: Date.now() - deleteScansStart,
      });
    } catch (error) {
      this.logger.endStep(false, "Delete scans failed");
      this.logger.warn("Continuing despite scan deletion failure");
      steps.push({
        name: "Delete Scans",
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - deleteScansStart,
      });
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

    console.log("\n");
  }
}

// Run the orchestrator
const orchestrator = new RepositorySyncOrchestrator();
await orchestrator.run();
