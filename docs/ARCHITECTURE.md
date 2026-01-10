# Architecture Documentation

## System Overview

The Repository Sync Orchestrator is a modular, type-safe automation tool built with TypeScript and Bun. It coordinates multiple services to manage archived repositories across a GitHub organization while synchronizing Socket.dev scan configurations.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Main Orchestrator                             │
│            (repo-sync-orchestrator.ts)                           │
└────┬────────────────────────────────────────────────────────────┘
     │
     ├─────────────────────────────────────────────────────────────┐
     │                                                              │
     ▼                    ▼                    ▼                    ▼
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ GitHub   │      │ Socket   │      │ Git      │      │ Logger   │
│ Client   │      │ Client   │      │ Ops      │      │ & Utils  │
└──────────┘      └──────────┘      └──────────┘      └──────────┘
     │                 │                  │                 │
     │                 │                  │                 │
     ▼                 ▼                  ▼                 ▼
┌────────────────────────────────────────────────────────────────┐
│              External Services & File System                    │
├────────────────────────────────────────────────────────────────┤
│  - GitHub REST API (Octokit)                                   │
│  - Socket.dev REST API (Axios)                                 │
│  - Git Command Execution (Bun)                                 │
│  - File System Operations                                      │
└────────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### 1. **Type Definitions** (`types/index.ts`)

Central type definitions for the entire system. Ensures type safety across all modules.

**Key Types:**
- `GitHubRepository` - GitHub API repository response
- `SocketScan` - Socket.dev scan object
- `ScriptConfig` - Runtime configuration
- `OperationResult` - Result of processing a repository
- `SummaryReport` - Final execution report

**Benefits:**
- Single source of truth for data structures
- Compile-time type checking
- Easier refactoring across the codebase
- Better IDE autocompletion

### 2. **GitHub Client** (`github/client.ts`)

Manages all GitHub API interactions using Octokit.

**Responsibilities:**
- Authenticate with GitHub API using PAT
- List all archived repositories in organization
- Verify authentication and organization access
- Handle pagination for large result sets
- Implement retry logic for rate limits

**Key Methods:**
```typescript
listArchivedRepositories(): Promise<GitHubRepository[]>
getRepository(name: string): Promise<GitHubRepository>
verifyAuth(): Promise<boolean>
verifyOrganization(): Promise<boolean>
```

**Error Handling:**
- Detects rate limiting (HTTP 403, 429)
- Implements exponential backoff
- Logs detailed error information

### 3. **Socket.dev Client** (`socket/client.ts`)

Manages Socket.dev API interactions for scan management.

**Responsibilities:**
- Authenticate with Socket.dev API
- List scans for a specific repository
- Delete scans by ID
- Batch delete all scans for a repository
- Handle API errors with retry logic

**Key Methods:**
```typescript
listScans(repoName: string): Promise<SocketScan[]>
deleteScan(scanId: string): Promise<void>
deleteAllScans(repoName: string): Promise<number>
verifyAuth(): Promise<boolean>
```

**Features:**
- Request/response interceptors for auth headers
- Custom error handling for different HTTP status codes
- Exponential backoff for transient failures
- Detailed error logging with response data

### 4. **Git Operations** (`git/operations.ts`)

Wraps pure `git` commands for repository operations.

**Responsibilities:**
- Execute git commands using Bun's process spawning
- Clone repositories to local directory
- Stage files for commit
- Create commits with custom messages
- Push changes to remote branch
- Retrieve repository metadata

**Key Methods:**
```typescript
clone(url: string, targetPath: string): Promise<void>
stageFile(filePath: string): Promise<void>
commit(message: string): Promise<void>
push(branch: string): Promise<void>
getCurrentBranch(): Promise<string>
getLatestCommitHash(): Promise<string>
getStatus(): Promise<string>
verifyGitConfig(): Promise<boolean>
```

**Design Decision - Pure Git Commands:**
- Uses `Bun.spawn()` to execute actual git CLI
- No abstraction layer or git library
- Simulates manual git operations as specified
- Captures stdout/stderr for error handling
- Timeout support for long-running operations

### 5. **Logger Utility** (`utils/logger.ts`)

Provides structured, timestamped logging throughout execution.

**Features:**
- Multiple log levels: debug, info, warn, error, success
- Color-coded console output
- File-based detailed logging
- Step timing measurements
- Metadata support for contextual information

**Key Methods:**
```typescript
info(message: string, metadata?: Record<string, unknown>)
warn(message: string, metadata?: Record<string, unknown>)
error(message: string, error?: Error, metadata?: Record<string, unknown>)
debug(message: string, metadata?: Record<string, unknown>)
success(message: string, metadata?: Record<string, unknown>)
startStep(stepName: string)
endStep(success: boolean, message?: string)
saveToFile(filePath: string)
```

**Implementation:**
- Maintains in-memory log buffer
- Colors defined as ANSI escape codes
- Supports configurable log levels
- Formats logs with timestamp, level, and metadata

### 6. **Configuration Management** (`utils/config.ts`)

Loads and validates environment variables.

**Responsibilities:**
- Load `.env` file using dotenv
- Validate all required tokens are present
- Validate token formats
- Validate organization names
- Validate API URLs
- Provide helpful error messages

**Key Functions:**
```typescript
loadConfig(isDryRun: boolean): ScriptConfig
validateConfig(config: ScriptConfig): void
logConfigSummary(config: ScriptConfig): void
```

**Validation Rules:**
- GitHub tokens must match pattern: `^(ghp_|ghs_|ghu_)[a-zA-Z0-9_]{36,255}$`
- Organization names follow GitHub username rules
- URLs must be valid and properly formatted
- All required fields must be present

### 7. **File Operations** (`utils/file-operations.ts`)

Handles socket.yml file creation and verification.

**Responsibilities:**
- Create socket.yml with standardized content
- Verify socket.yml exists and has correct content
- Support for dry-run mode

**Key Functions:**
```typescript
createSocketYml(repoPath: string, logger: Logger, dryRun: boolean)
socketYmlExists(repoPath: string): Promise<boolean>
getSocketYmlContent(): string
verifySocketYml(repoPath: string, logger: Logger): Promise<boolean>
```

**Socket.yml Content:**
```yaml
version: 2
githubApp:
  enabled: false
```

### 8. **Utility Helpers** (`utils/helpers.ts`)

General-purpose utility functions used across modules.

**Functions:**
```typescript
generateLogFilePath(): string
sleep(ms: number): Promise<void>
calculateBackoffDelay(attemptNumber: number): number
sanitizeRepoName(name: string): string
formatDuration(ms: number): string
extractDomainFromGitUrl(url: string): string
parseCliArgs(args: string[]): Record<string, string | boolean>
isValidGitHubToken(token: string): boolean
isValidOrgName(name: string): boolean
ensureDirectory(dirPath: string): Promise<void>
removeDirectory(dirPath: string): Promise<void>
fileExists(filePath: string): Promise<boolean>
getCurrentTimestamp(): string
calculatePercentage(part: number, total: number): number
```

### 9. **Constants** (`utils/constants.ts`)

Centralized configuration values and constants.

```typescript
CONSTANTS = {
  SOCKET_YML_FILENAME: 'socket.yml',
  SOCKET_YML_CONTENT: '...',
  COMMIT_MESSAGE: '...',
  DEFAULT_MAIN_BRANCH: 'main',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  GIT_CLONE_TIMEOUT_MS: 300000,
  API_TIMEOUT_MS: 30000,
  // ...
}

HTTP_STATUS = {
  OK: 200,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  // ...
}
```

### 10. **Main Orchestrator** (`repo-sync-orchestrator.ts`)

Coordinates all services to execute the main workflow.

**Responsibilities:**
- Parse CLI arguments
- Load and validate configuration
- Initialize all clients and services
- Orchestrate the processing workflow
- Generate summary reports
- Handle errors and exit codes

**Execution Phases:**

1. **Initialization Phase**
   - Parse arguments
   - Load config from environment
   - Validate configuration
   - Initialize clients

2. **Verification Phase**
   - Verify GitHub authentication
   - Verify Socket.dev authentication
   - Verify organization exists

3. **Discovery Phase**
   - Fetch all archived repositories
   - Log repository list

4. **Processing Phase** (per repository)
   - Clone repository
   - Create socket.yml
   - Stage changes
   - Commit changes
   - List and delete scans
   - Push to main branch
   - Clean up temporary files

5. **Reporting Phase**
   - Aggregate results
   - Generate summary report
   - Log summary statistics
   - Save detailed logs to file

6. **Cleanup Phase**
   - Remove temporary directories
   - Exit with appropriate status code

## Data Flow

### Repository Processing Workflow

```
GitHub Repo
    │
    ▼
Clone to temp directory
    │
    ▼
Create socket.yml
    │
    ▼
Stage socket.yml
    │
    ▼
Commit changes
    │
    ▼
List Socket.dev scans
    │
    ▼
Delete Socket.dev scans
    │
    ▼
Push to main branch
    │
    ▼
Clean up temp directory
    │
    ▼
OperationResult
```

### Error Handling Flow

```
Operation Failed
    │
    ├─ Retryable Error?
    │   ├─ Yes → Max retries exceeded?
    │   │         ├─ No → Retry with backoff
    │   │         └─ Yes → Fail operation
    │   │
    │   └─ No → Fail operation immediately
    │
    ▼
Log error with details
Log context and metadata
Continue to next repository
```

## Design Patterns

### 1. **Dependency Injection**
Each class receives its dependencies (logger, config) in the constructor, making it testable and loosely coupled.

### 2. **Separation of Concerns**
Each module has a single responsibility:
- GitHub module handles GitHub API
- Socket module handles Socket.dev API
- Git module handles git operations
- Logger handles logging

### 3. **Error Handling Strategy**
- Validation at configuration load time
- Try-catch blocks at operation boundaries
- Detailed error logging with context
- Graceful degradation (continue with next repo on failure)

### 4. **Async/Await Pattern**
- All long-running operations are async
- Proper error handling in async chains
- No callback hell or promise chains

### 5. **Dry-Run Support**
- Checks `dryRun` flag before mutations
- Logs what would happen without executing
- Allows safe testing before production run

## Type Safety

The entire codebase uses TypeScript strict mode:
- `strict: true`
- `strictNullChecks: true`
- `noImplicitAny: true`
- `forceConsistentCasingInFileNames: true`

Benefits:
- Catches type errors at compile time
- Prevents common runtime errors
- Better IDE support and autocomplete
- Easier refactoring

## Performance Considerations

### Optimization Strategies:
1. **Parallel Operations** - Future enhancement: process multiple repos in parallel with concurrency control
2. **Caching** - Future: cache organization metadata to avoid repeated API calls
3. **Batching** - Batch Socket.dev scan deletions
4. **Timeouts** - Configurable timeouts for git and API operations
5. **Early Exit** - Exit immediately on critical auth failures

### Resource Usage:
- Temporary files stored in configurable directory
- Automatic cleanup after processing
- Limited retry attempts to prevent infinite loops
- Configurable request timeouts

## Extensibility

The modular design supports future enhancements:

### Adding New API Clients:
1. Create new file in `socket/` or `github/`
2. Implement client with standard structure
3. Inject into orchestrator
4. Add to workflow

### Adding New File Operations:
1. Extend `file-operations.ts`
2. Add new functions following existing patterns
3. Use in orchestrator step

### Adding New Workflow Steps:
1. Create step in orchestrator
2. Handle success and failure cases
3. Add to `OperationResult.steps` array
4. Log results appropriately

## Testing Strategy

Current state: Unit testing ready with dependency injection pattern.

Future testing approach:
- Mock GitHub and Socket.dev clients
- Mock file system operations
- Test each module independently
- Integration tests for orchestrator
- E2E tests with real APIs (dry-run mode)

## Deployment

The package is designed as a Bun executable:
```bash
bun scripts/repo-sync-orchestrator.ts [flags]
```

Can be:
- Run locally from command line
- Scheduled via cron or task scheduler
- Integrated into CI/CD pipelines
- Containerized for cloud deployment

## Security Considerations

1. **Token Management**
   - Tokens loaded from environment (.env in .gitignore)
   - Never logged or displayed in output
   - Validated on startup

2. **Git Operations**
   - Uses system git command (no embedded binary)
   - No automatic credential storage
   - Relies on SSH keys or git credential helpers

3. **File System**
   - Respects file permissions
   - Cleans up temporary files
   - Validates file paths

4. **Error Messages**
    - Don't include sensitive information
    - Provide helpful guidance without exposing internals

---

## Related Documentation

- **[📖 Quick Start](QUICKSTART.md)** - Get started in 5 minutes
- **[⚙️ Usage Reference](USAGE.md)** - Commands and configuration
- **[❓ Troubleshooting](TROUBLESHOOTING.md)** - Error handling and debugging
- **[🔧 Development](DEVELOPMENT.md)** - Development setup and contribution
- **[📋 Build Summary](BUILD.md)** - Implementation details

---

**Quick Links**: [📖 Back to README](../README.md) | [📖 Quick Start](QUICKSTART.md) | [⚙️ Usage Reference](USAGE.md)
