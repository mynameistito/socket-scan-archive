export const CONSTANTS = {
  SOCKET_YML_FILENAME: "socket.yml",
  SOCKET_YML_CONTENT: `version: 2
githubApp:
  enabled: false
`,
  COMMIT_MESSAGE: "Add Socket.yml configuration for security scanning",
  DEFAULT_MAIN_BRANCH: "main",
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  GIT_CLONE_TIMEOUT_MS: 300_000, // 5 minutes
  API_TIMEOUT_MS: 30_000, // 30 seconds
  DEFAULT_LOG_LEVEL: "info" as const,
  LOG_FILE_PREFIX: "repo-sync",
  LOG_DIRECTORY: "./logs",
  TEMP_REPOS_DIRECTORY: "./temp-repos",
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};
