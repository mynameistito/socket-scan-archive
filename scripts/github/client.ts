import { Octokit } from "@octokit/rest";
import type { GitHubRepository } from "../types/index";
import { CONSTANTS } from "../utils/constants";
import { calculateBackoffDelay, sleep } from "../utils/helpers";
import type { Logger } from "../utils/logger";

export class GitHubClient {
  private readonly octokit: Octokit;
  private readonly org: string;
  private readonly logger: Logger;

  constructor(token: string, org: string, logger: Logger) {
    this.octokit = new Octokit({
      auth: token,
      baseUrl: "https://api.github.com",
    });
    this.org = org;
    this.logger = logger;
  }

  /**
   * List all archived repositories in the organization
   */
  async listArchivedRepositories(retries = 0): Promise<GitHubRepository[]> {
    try {
      this.logger.debug(
        `Fetching archived repositories for organization: ${this.org}`
      );

      const repos: GitHubRepository[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.octokit.rest.repos.listForOrg({
          org: this.org,
          per_page: 100,
          page,
          sort: "updated",
          direction: "desc",
        });

        if (response.data.length === 0) {
          hasMore = false;
        } else {
          // Filter for archived repos only
          const archivedRepos = response.data.filter(
            (repo) => repo.archived === true
          );
          repos.push(
            ...archivedRepos.map((repo) => ({
              id: repo.id,
              name: repo.name,
              full_name: repo.full_name,
              owner: {
                login: repo.owner?.login || "unknown",
                type: repo.owner?.type || "unknown",
              },
              html_url: repo.html_url,
              archived: true,
              private: repo.private,
              default_branch: repo.default_branch || "main",
            }))
          );
          page++;
        }
      }

      this.logger.info(`Found ${repos.length} archived repositories`);
      for (const repo of repos) {
        this.logger.debug(`  - ${repo.name}`, {
          url: repo.html_url,
          private: repo.private,
        });
      }

      return repos;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if it's a rate limit error
      if (
        (err.message.includes("403") || err.message.includes("rate limit")) &&
        retries < CONSTANTS.MAX_RETRIES
      ) {
        const delay = calculateBackoffDelay(retries);
        this.logger.warn(
          `Rate limited, waiting ${delay}ms before retry (attempt ${retries + 1}/${CONSTANTS.MAX_RETRIES})`
        );
        await sleep(delay);
        return this.listArchivedRepositories(retries + 1);
      }

      this.logger.error("Failed to list archived repositories", err);
      throw err;
    }
  }

  /**
   * Get a single repository by name
   */
  async getRepository(name: string): Promise<GitHubRepository> {
    try {
      this.logger.debug(`Fetching repository: ${this.org}/${name}`);

      const response = await this.octokit.rest.repos.get({
        owner: this.org,
        repo: name,
      });

      return {
        id: response.data.id,
        name: response.data.name,
        full_name: response.data.full_name,
        owner: {
          login: response.data.owner.login,
          type: response.data.owner.type,
        },
        html_url: response.data.html_url,
        archived: response.data.archived,
        private: response.data.private,
        default_branch: response.data.default_branch,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to fetch repository ${name}`, err);
      throw err;
    }
  }

  /**
   * Verify authentication is working
   */
  async verifyAuth(): Promise<boolean> {
    try {
      this.logger.debug("Verifying GitHub authentication...");
      const response = await this.octokit.rest.users.getAuthenticated();
      this.logger.debug(`Authenticated as: ${response.data.login}`);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("GitHub authentication verification failed", err);
      return false;
    }
  }

  /**
   * Check if organization exists
   */
  async verifyOrganization(): Promise<boolean> {
    try {
      this.logger.debug(`Verifying organization: ${this.org}`);
      await this.octokit.rest.orgs.get({
        org: this.org,
      });
      this.logger.debug(`Organization verified: ${this.org}`);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Organization verification failed for ${this.org}`,
        err
      );
      return false;
    }
  }

  /**
   * Unarchive a repository
   * Required scope: admin:repo_hook or fine-grained "Administration" write
   */
  async unarchiveRepository(repoName: string): Promise<boolean> {
    try {
      this.logger.debug(`Unarchiving repository: ${repoName}`);
      await this.octokit.rest.repos.update({
        owner: this.org,
        repo: repoName,
        archived: false,
      });
      this.logger.debug(`Repository unarchived: ${repoName}`);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message.includes("403") || err.message.includes("Forbidden")) {
        this.logger.error(
          `Permission denied unarchiving ${repoName}. Ensure GitHub token has admin:repo_hook scope or fine-grained "Administration" write permission`,
          err
        );
      } else {
        this.logger.error(`Failed to unarchive repository ${repoName}`, err);
      }
      return false;
    }
  }

  /**
   * Rearchive a repository
   * Required scope: admin:repo_hook or fine-grained "Administration" write
   */
  async rearchiveRepository(repoName: string): Promise<boolean> {
    try {
      this.logger.debug(`Rearchiving repository: ${repoName}`);
      await this.octokit.rest.repos.update({
        owner: this.org,
        repo: repoName,
        archived: true,
      });
      this.logger.debug(`Repository rearchived: ${repoName}`);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message.includes("403") || err.message.includes("Forbidden")) {
        this.logger.error(
          `Permission denied rearchiving ${repoName}. Ensure GitHub token has admin:repo_hook scope`,
          err
        );
      } else {
        this.logger.error(`Failed to rearchive repository ${repoName}`, err);
      }
      return false;
    }
  }
}
