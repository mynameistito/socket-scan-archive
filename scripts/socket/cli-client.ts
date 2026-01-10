import type { Logger } from "../utils/logger";
import { CONSTANTS } from "../utils/constants";

/**
 * Socket CLI operation result
 */
export interface SocketDeleteResult {
  success: boolean;
  message: string;
  repoName: string;
  scansDeleted?: number;
}

/**
 * Socket CLI Client
 * Uses Socket CLI commands instead of direct API calls
 */
export class SocketCLIClient {
  private readonly apiToken: string;
  private readonly logger: Logger;

  constructor(apiToken: string, logger: Logger) {
    this.apiToken = apiToken;
    this.logger = logger;
  }

  /**
   * Delete a repository via Socket CLI
   * Executes: socket repository del {org} {repoName}
   */
  async deleteRepository(
    orgSlug: string,
    repoName: string,
    isDryRun = false
  ): Promise<SocketDeleteResult> {
    this.logger.debug(
      `[${isDryRun ? "DRY-RUN" : "EXEC"}] Deleting repository: ${repoName} from org: ${orgSlug}`
    );

    if (isDryRun) {
      return {
        success: true,
        message: `[DRY-RUN] Would delete repository: ${repoName}`,
        repoName,
      };
    }

    try {
      const result = await this.executeSocketCommand([
        "repository",
        "del",
        orgSlug,
        repoName,
      ]);

      if (result.exitCode === 0) {
        this.logger.info(
          `✅ Successfully deleted repository: ${repoName} from ${orgSlug}`
        );
        return {
          success: true,
          message: `Repository ${repoName} deleted successfully`,
          repoName,
        };
      }

      const errorMsg = result.stderr || result.stdout || "Unknown error";
      this.logger.warn(
        `⚠️ Failed to delete repository ${repoName}: ${errorMsg}`
      );
      return {
        success: false,
        message: `Failed to delete repository: ${errorMsg}`,
        repoName,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      this.logger.warn(
        `⚠️ Exception deleting repository ${repoName}: ${message}`
      );
      return {
        success: false,
        message: `Exception: ${message}`,
        repoName,
      };
    }
  }

  /**
   * Execute Socket CLI command
   * @private
   */
  private executeSocketCommand(args: string[]): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve) => {
      try {
        const proc = Bun.spawn(["socket", ...args], {
          env: {
            ...process.env,
            SOCKET_API_TOKEN: this.apiToken,
          },
          timeout: CONSTANTS.API_TIMEOUT_MS,
        });

        // Wait for process to exit and collect output
        proc.exited
          .then(async (exitCode) => {
            const stdout = await new Response(proc.stdout).text();
            const stderr = await new Response(proc.stderr).text();

            resolve({
              exitCode: exitCode || 0,
              stdout,
              stderr,
            });
          })
          .catch((err) => {
            this.logger.error(`Socket CLI execution error: ${err}`);
            resolve({
              exitCode: 1,
              stdout: "",
              stderr: err instanceof Error ? err.message : String(err),
            });
          });
      } catch (error) {
        this.logger.error(
          `Failed to spawn Socket CLI process: ${error instanceof Error ? error.message : String(error)}`
        );
        resolve({
          exitCode: 1,
          stdout: "",
          stderr:
            error instanceof Error ? error.message : "Failed to spawn process",
        });
      }
    });
  }
}
