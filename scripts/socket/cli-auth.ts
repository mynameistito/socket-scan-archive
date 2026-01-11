import type { Logger } from "../utils/logger";

/**
 * Socket CLI Authentication
 * Handles login/logout with Socket CLI
 */
export class SocketCLIAuth {
  private readonly logger: Logger;
  private isAuthenticated = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Prepare Socket.dev API authentication
   * For non-interactive environments, just validates the token
   * For interactive environments, can login via CLI
   */
  async login(apiToken?: string, orgSlug?: string): Promise<boolean> {
    try {
      this.logger.info("Preparing Socket.dev authentication...");

      // Determine which token to use
      let tokenToUse = apiToken;

      if (!tokenToUse) {
        // Check environment variable
        tokenToUse = process.env.SOCKET_API_TOKEN?.trim();
      }

      if (!tokenToUse && this.isInteractive()) {
        // Prompt user interactively (for interactive terminals)
        tokenToUse = await this.promptForToken();
      }

      if (!tokenToUse) {
        this.logger.error("No API token provided");
        this.logger.error(
          "Please set SOCKET_API_TOKEN in .env or provide it interactively"
        );
        return false;
      }

      // Set environment variables for Socket CLI
      // Socket CLI expects SOCKET_CLI_API_TOKEN, not SOCKET_API_TOKEN
      process.env.SOCKET_CLI_API_TOKEN = tokenToUse;
      if (orgSlug) {
        process.env.SOCKET_CLI_ORG_SLUG = orgSlug;
      }

      // In non-interactive mode, just validate that we have a token
      // Socket CLI will use SOCKET_CLI_API_TOKEN environment variable
      this.isAuthenticated = true;
      this.logger.success("✅ Socket.dev authentication prepared");
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      this.logger.error(`Exception during authentication setup: ${message}`);
      return false;
    }
  }

  /**
   * Cleanup Socket.dev authentication
   * Clears the stored token from environment
   */
  logout(): boolean {
    try {
      if (!this.isAuthenticated) {
        this.logger.debug("Not authenticated, skipping logout");
        return true;
      }

      this.logger.info("Cleaning up Socket.dev authentication...");

      // Clear the tokens from environment
      process.env.SOCKET_CLI_API_TOKEN = "";
      process.env.SOCKET_CLI_ORG_SLUG = "";
      this.isAuthenticated = false;

      this.logger.success("✅ Successfully cleared Socket.dev authentication");
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      this.logger.error(`Exception during logout: ${message}`);
      return false;
    }
  }

  /**
   * Check if currently authenticated
   */
  isLoggedIn(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Check if running in interactive terminal
   * @private
   */
  private isInteractive(): boolean {
    return process.stdin?.isTTY ?? false;
  }

  /**
   * Prompt user for API token interactively
   * @private
   */
  private promptForToken(): Promise<string | undefined> {
    return new Promise((resolve) => {
      try {
        // Use Node.js readline for prompting
        const readline = require("node:readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.question(
          "Enter your Socket.dev API token (starts with sk_): ",
          (token: string) => {
            rl.close();
            resolve(token?.trim() || undefined);
          }
        );
      } catch {
        // Fallback if readline fails
        this.logger.warn(
          "Interactive prompt not available, please set SOCKET_API_TOKEN in .env"
        );
        resolve(undefined);
      }
    });
  }
}
