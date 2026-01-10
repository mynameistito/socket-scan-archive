import axios, { type AxiosInstance } from "axios";
import type { SocketScan, SocketScanResponse } from "../types/index";
import { CONSTANTS, HTTP_STATUS } from "../utils/constants";
import { calculateBackoffDelay, sleep } from "../utils/helpers";
import type { Logger } from "../utils/logger";

export class SocketClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly logger: Logger;

  constructor(apiToken: string, baseUrl: string, logger: Logger) {
    this.logger = logger;

    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: CONSTANTS.API_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === HTTP_STATUS.RATE_LIMITED) {
          this.logger.warn("Socket.dev API rate limit hit");
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * List all scans for a specific repository
   */
  async listScans(repoName: string, retries = 0): Promise<SocketScan[]> {
    try {
      this.logger.debug(`Fetching scans for repository: ${repoName}`);

      const response = await this.axiosInstance.get<SocketScanResponse>(
        "/scans",
        {
          params: {
            repo: repoName,
          },
        }
      );

      const scans = response.data.data || [];
      this.logger.debug(`Found ${scans.length} scans for ${repoName}`);

      return scans;
    } catch (error) {
      return this.handleError(error, "listScans", repoName, retries, () =>
        this.listScans(repoName, retries + 1)
      );
    }
  }

  /**
   * Delete a specific scan by ID
   */
  async deleteScan(scanId: string, retries = 0): Promise<void> {
    try {
      this.logger.debug(`Deleting scan: ${scanId}`);

      await this.axiosInstance.delete(`/scans/${scanId}`);

      this.logger.debug(`Successfully deleted scan: ${scanId}`);
    } catch (error) {
      return this.handleError(error, "deleteScan", scanId, retries, () =>
        this.deleteScan(scanId, retries + 1)
      );
    }
  }

  /**
   * Delete all scans for a repository
   */
  async deleteAllScans(repoName: string): Promise<number> {
    try {
      this.logger.debug(`Deleting all scans for repository: ${repoName}`);

      const scans = await this.listScans(repoName);

      if (scans.length === 0) {
        this.logger.info(`No scans found for ${repoName}`);
        return 0;
      }

      this.logger.info(`Deleting ${scans.length} scans for ${repoName}`);

      for (const scan of scans) {
        try {
          await this.deleteScan(scan.id);
        } catch (deleteError) {
          this.logger.warn(`Failed to delete scan ${scan.id}`, {
            scanId: scan.id,
            error:
              deleteError instanceof Error
                ? deleteError.message
                : String(deleteError),
          });
        }
      }

      this.logger.success(`Deleted ${scans.length} scans for ${repoName}`);
      return scans.length;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to delete all scans for ${repoName}`, err);
      throw err;
    }
  }

  /**
   * Verify Socket.dev API token is valid
   */
  async verifyAuth(): Promise<boolean> {
    try {
      this.logger.debug("Verifying Socket.dev API token...");

      // Try to make a simple API call to verify auth
      await this.axiosInstance.get("/health");

      this.logger.debug("Socket.dev API token verified");
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn("Socket.dev API authentication verification failed", {
        error: err.message,
        operation: "verifyAuth",
      });
      return false;
    }
  }

  /**
   * Handle API errors with retry logic
   */
  private async handleError<T>(
    error: unknown,
    operation: string,
    operand: string,
    retries: number,
    retryFn: () => Promise<T>
  ): Promise<T> {
    const err = error instanceof Error ? error : new Error(String(error));

    // Check if it's a retryable error
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === HTTP_STATUS.RATE_LIMITED ||
        error.code === "ECONNREFUSED" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ENOTFOUND") &&
      retries < CONSTANTS.MAX_RETRIES
    ) {
      const delay = calculateBackoffDelay(retries);
      this.logger.warn(
        `${operation} failed (${operand}), retrying in ${delay}ms (attempt ${retries + 1}/${CONSTANTS.MAX_RETRIES})`
      );
      await sleep(delay);
      return retryFn();
    }

    // Log error details
    if (axios.isAxiosError(error)) {
      const errorData = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        data: error.response?.data,
      };
      this.logger.error(`${operation} failed for ${operand}`, err, errorData);
    } else {
      this.logger.error(`${operation} failed for ${operand}`, err);
    }

    throw err;
  }
}
