/**
 * GitHub API Types
 */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    type: string;
  };
  html_url: string;
  archived: boolean;
  private: boolean;
  default_branch: string;
}

export interface GitHubOrganization {
  login: string;
  type: string;
}

/**
 * Socket.dev API Types
 */
export interface SocketScan {
  id: string;
  repo: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface SocketScanResponse {
  data: SocketScan[];
  total: number;
}

/**
 * Script Configuration
 */
export interface ScriptConfig {
  githubToken: string;
  socketApiToken: string;
  githubOrg: string;
  reposBasePath: string;
  dryRun: boolean;
  socketBaseUrl: string;
  githubBaseUrl: string;
  logLevel: "debug" | "info" | "warn" | "error";
}

/**
 * Operation Step Result
 */
export interface StepResult {
  name: string;
  success: boolean;
  message: string;
  duration: number;
  timestamp?: Date;
}

/**
 * Operation Result for a single repository
 */
export interface OperationResult {
  repoName: string;
  success: boolean;
  steps: StepResult[];
  error?: Error;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
}

/**
 * Summary Report
 */
export interface SummaryReport {
  totalArchivedRepos: number;
  processedRepos: number;
  successfulOperations: number;
  failedOperations: number;
  totalDuration: number;
  results: OperationResult[];
  dryRun: boolean;
  startTime: Date;
  endTime: Date;
}

/**
 * Log Entry
 */
export interface LogEntry {
  level: "debug" | "info" | "warn" | "error" | "success";
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  error?: Error;
}
