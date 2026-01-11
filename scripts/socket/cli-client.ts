import { CONSTANTS } from "../utils/constants";
import type { Logger } from "../utils/logger";

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
  private readonly orgSlug: string;
  private readonly logger: Logger;

  constructor(apiToken: string, orgSlug: string, logger: Logger) {
    this.apiToken = apiToken;
    this.orgSlug = orgSlug;
    this.logger = logger;
  }

  /**
   * Mask sensitive token for logging
   * Shows only first 3 and last 3 characters
   */
  private maskToken(token: string): string {
    if (token.length <= 6) {
      return "****";
    }
    return `${token.substring(0, 3)}****${token.substring(token.length - 3)}`;
  }

  /**
   * Verify Socket.dev authentication by listing repositories
   * Pre-flight check to catch auth issues early
   */
  async verifyAuthentication(): Promise<boolean> {
    try {
      this.logger.info("🔐 Verifying Socket.dev authentication...");
      this.logger.debug(
        `Auth check: org=${this.orgSlug}, token=${this.maskToken(
          this.apiToken
        )}`
      );

      const result = await this.executeSocketCommand([
        "repository",
        "list",
        "--org",
        this.orgSlug,
      ]);

      if (result.exitCode === 0) {
        this.logger.success("✅ Socket.dev authentication verified");
        return true;
      }

      const fullErrorOutput = [result.stderr, result.stdout]
        .filter((s) => s && s.length > 0)
        .join("\n");

      this.logger.error(`❌ Authentication failed: ${fullErrorOutput}`);
      return false;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      this.logger.error(`❌ Authentication error: ${message}`);
      return false;
    }
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
        "--org",
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

      // Combine stderr and stdout for error message
      const fullErrorOutput = [result.stderr, result.stdout]
        .filter((s) => s && s.length > 0)
        .join("\n");
      const errorMsg = fullErrorOutput || "Unknown error";

      // Debug log the full error output
      this.logger.debug(
        `Socket CLI error output - exitCode: ${result.exitCode}, stderr: ${result.stderr}, stdout: ${result.stdout}`
      );

      // Check if repository was not found (404) - treat as success since end state is achieved
      if (
        errorMsg.includes("Repository not found") ||
        errorMsg.includes("404") ||
        errorMsg.includes("Not Found") ||
        errorMsg.includes("Resource not found")
      ) {
        this.logger.info(
          `⏭️ Repository ${repoName} not found (already deleted or doesn't exist) - skipping`
        );
        return {
          success: true,
          message: `Repository ${repoName} was not found (already deleted or doesn't exist)`,
          repoName,
        };
      }

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
   * Execute Socket CLI command with proper authentication
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
            SOCKET_CLI_API_TOKEN: this.apiToken,
            SOCKET_CLI_ORG_SLUG: this.orgSlug,
          },
          stdout: "pipe",
          stderr: "pipe",
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
          `Failed to spawn Socket CLI process: ${
            error instanceof Error ? error.message : String(error)
          }`
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
