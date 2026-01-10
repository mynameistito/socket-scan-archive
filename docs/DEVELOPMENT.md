# Development Guide

Setup your development environment, understand the codebase, and contribute to the project.

## Development Environment Setup

### Prerequisites

- **Node.js/Bun**: Version 1.3.4 or higher
- **Git**: For version control
- **TypeScript**: Knowledge of TypeScript basics

### Initial Setup

```bash
# Clone the repository (if not already cloned)
git clone https://github.com/KillzoneGaming/socket-scan.git
cd socket-scan

# Install dependencies
bun install

# Verify TypeScript compilation
bun run tsc

# Check code quality
bun run lint
```

### Verify Installation

```bash
# Test configuration
bun run check-config

# Preview with dry-run
bun run start:dry
```

## Code Management

### Code Formatting

```bash
# Auto-format code using Biome
bun run fix
```

Run this before committing to ensure consistent formatting.

### Code Quality Checks

```bash
# Lint code for style violations
bun run lint

# Run comprehensive Biome CI checks
bun run ci

# Check TypeScript compilation
bun run tsc
```

### Before Committing

```bash
# 1. Check types
bun run tsc

# 2. Fix formatting
bun run fix

# 3. Verify linting
bun run lint

# 4. Test with dry-run
bun run start:dry
```

## Project Structure

### Directory Layout

```
socket-scan/
├── scripts/                           # TypeScript source code
│   ├── repo-sync-orchestrator.ts      # Main entry point (420 lines)
│   │                                  # Coordinates entire workflow
│   │
│   ├── github/
│   │   └── client.ts                  # GitHub API client (127 lines)
│   │                                  # Lists and verifies repositories
│   │
│   ├── socket/
│   │   └── client.ts                  # Socket.dev API client (163 lines)
│   │                                  # Manages scan listing and deletion
│   │
│   ├── git/
│   │   └── operations.ts              # Git operations wrapper (213 lines)
│   │                                  # Cloning, committing, pushing
│   │
│   ├── types/
│   │   └── index.ts                   # TypeScript interfaces (92 lines)
│   │                                  # Type-safe data structures
│   │
│   ├── utils/
│   │   ├── logger.ts                  # Structured logging (132 lines)
│   │   ├── config.ts                  # Configuration management (98 lines)
│   │   ├── file-operations.ts         # socket.yml management (71 lines)
│   │   ├── helpers.ts                 # Utility functions (151 lines)
│   │   └── constants.ts               # Constants and defaults (37 lines)
│   │
│   └── cleanup.ts                     # Cleanup utility script
│
├── docs/                              # Documentation
│   ├── QUICKSTART.md                  # 5-minute setup guide
│   ├── USAGE.md                       # Commands and configuration
│   ├── TROUBLESHOOTING.md             # Error handling and debugging
│   ├── DEVELOPMENT.md                 # This file
│   ├── ARCHITECTURE.md                # System design deep-dive
│   └── BUILD.md                       # Implementation summary
│
├── logs/                              # Generated log files
├── temp-repos/                        # Temporary repository clones
├── package.json                       # NPM/Bun package configuration
├── tsconfig.json                      # TypeScript compiler options
├── biome.jsonc                        # Biome linter/formatter config
├── .env.example                       # Environment variables template
├── .gitignore                         # Git ignore rules
├── README.md                          # Main documentation
└── LICENSE                            # MIT License
```

### Module Breakdown

#### Type Definitions (`scripts/types/index.ts`)

Central type definitions for type safety across all modules.

**Key Types:**
```typescript
interface GitHubRepository { }
interface SocketScan { }
interface ScriptConfig { }
interface OperationResult { }
interface SummaryReport { }
```

#### GitHub Client (`scripts/github/client.ts`)

Manages all GitHub API interactions using Octokit.

**Responsibilities:**
- Authenticate with GitHub API
- List all archived repositories
- Verify authentication and organization access
- Handle pagination for large result sets
- Implement retry logic

**Key Methods:**
```typescript
listArchivedRepositories(): Promise<GitHubRepository[]>
getRepository(name: string): Promise<GitHubRepository>
verifyAuth(): Promise<boolean>
verifyOrganization(): Promise<boolean>
```

#### Socket.dev Client (`scripts/socket/client.ts`)

Manages Socket.dev API interactions for scan management.

**Responsibilities:**
- Authenticate with Socket.dev API
- List scans for specific repositories
- Delete scans by ID
- Batch delete operations
- Handle API errors with retry logic

**Key Methods:**
```typescript
listScans(repoName: string): Promise<SocketScan[]>
deleteScan(scanId: string): Promise<void>
deleteAllScans(repoName: string): Promise<number>
verifyAuth(): Promise<boolean>
```

#### Git Operations (`scripts/git/operations.ts`)

Wraps pure git commands for repository operations.

**Responsibilities:**
- Execute git commands using Bun's process spawning
- Clone repositories to local directory
- Stage files for commit
- Create commits with custom messages
- Push changes to remote branch

**Key Methods:**
```typescript
clone(url: string, targetPath: string): Promise<void>
stageFile(filePath: string): Promise<void>
commit(message: string): Promise<void>
push(branch: string): Promise<void>
getCurrentBranch(): Promise<string>
getStatus(): Promise<string>
verifyGitConfig(): Promise<boolean>
```

#### Logger (`scripts/utils/logger.ts`)

Provides structured, timestamped logging throughout execution.

**Features:**
- Multiple log levels: debug, info, warn, error, success
- Color-coded console output
- File-based detailed logging
- Step timing measurements
- Metadata support

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

#### Configuration (`scripts/utils/config.ts`)

Loads and validates environment variables.

**Responsibilities:**
- Load `.env` file using dotenv
- Validate required tokens
- Validate token formats
- Validate organization names
- Validate API URLs
- Provide helpful error messages

**Validation Rules:**
- GitHub tokens: `^(ghp_|ghs_|ghu_)[a-zA-Z0-9_]{36,255}$`
- Organization names follow GitHub username rules
- URLs must be valid and properly formatted

#### File Operations (`scripts/utils/file-operations.ts`)

Handles socket.yml file creation and verification.

**Key Functions:**
```typescript
createSocketYml(repoPath: string, logger: Logger, dryRun: boolean)
socketYmlExists(repoPath: string): Promise<boolean>
getSocketYmlContent(): string
verifySocketYml(repoPath: string, logger: Logger): Promise<boolean>
```

#### Helpers (`scripts/utils/helpers.ts`)

General-purpose utility functions.

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

#### Constants (`scripts/utils/constants.ts`)

Centralized configuration values.

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
}
```

#### Main Orchestrator (`scripts/repo-sync-orchestrator.ts`)

Coordinates all services to execute the main workflow.

**Execution Phases:**
1. Initialization - Parse arguments, load config
2. Verification - Test authentication
3. Discovery - Fetch archived repositories
4. Processing - Clone, update, commit, push each repo
5. Reporting - Generate summary report
6. Cleanup - Remove temporary directories

## Design Patterns

### Dependency Injection

Each class receives its dependencies in the constructor:

```typescript
const logger = new Logger(isDryRun);
const githubClient = new GitHubClient(config, logger);
```

Benefits:
- Easy to test with mock dependencies
- Loosely coupled modules
- Clear dependency chains

### Separation of Concerns

Each module has a single responsibility:
- GitHub module: GitHub API interactions
- Socket module: Socket.dev API interactions
- Git module: Git operations
- Logger: Logging functionality
- Config: Configuration management

### Error Handling Strategy

1. **Validation at startup** - Check config is valid
2. **Try-catch at operation boundaries** - Catch errors
3. **Detailed error logging** - Log with context
4. **Graceful degradation** - Continue with next repo on failure

### Async/Await Pattern

All long-running operations are async:

```typescript
async function processRepository(repo: GitHubRepository): Promise<void> {
  try {
    await gitOps.clone(repo.clone_url, repoPath);
    await createSocketYml(repoPath);
    // ... more operations
  } catch (error) {
    logger.error('Failed to process repository', error);
  }
}
```

### Dry-Run Support

Check `dryRun` flag before mutations:

```typescript
if (!dryRun) {
  await gitOps.push(branch);
} else {
  logger.info('Would push to main branch');
}
```

## Adding New Features

### Adding a New API Client

1. Create new file in `scripts/[service]/client.ts`
2. Implement client with standard structure:
   ```typescript
   class MyServiceClient {
     constructor(config: ScriptConfig, logger: Logger) { }
     async verifyAuth(): Promise<boolean> { }
     async performOperation(): Promise<void> { }
   }
   ```
3. Add initialization to orchestrator
4. Add to workflow in orchestrator

### Adding New File Operations

1. Extend `scripts/utils/file-operations.ts`
2. Add new functions following existing patterns:
   ```typescript
   export async function myOperation(path: string): Promise<void> {
     // Implementation
   }
   ```
3. Use in orchestrator step

### Adding New Workflow Steps

1. Create step function in orchestrator
2. Handle success and failure cases
3. Add to `OperationResult.steps` array
4. Log results appropriately

## Type Safety

The entire codebase uses TypeScript strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Benefits:
- Catches type errors at compile time
- Prevents common runtime errors
- Better IDE support
- Easier refactoring

## Testing Strategy

Current state: Unit testing ready with dependency injection pattern.

### Future Testing Approach

```typescript
// Mock GitHub client
class MockGitHubClient implements IGitHubClient {
  async listArchivedRepositories(): Promise<GitHubRepository[]> {
    return [/* mock data */];
  }
}

// Test orchestrator with mocks
const orchestrator = new Orchestrator(mockGitHub, mockSocket, mockGit, logger);
```

### Testing Areas

- Unit tests for each module
- Integration tests for orchestrator
- E2E tests with real APIs (dry-run mode)

## Performance Considerations

### Optimization Strategies

1. **Parallel Operations** - Process multiple repos in parallel (future)
2. **Caching** - Cache organization metadata (future)
3. **Batching** - Batch Socket.dev scan deletions (current)
4. **Timeouts** - Configurable timeouts for operations
5. **Early Exit** - Exit immediately on critical auth failures

### Resource Usage

- Temporary files stored in configurable directory
- Automatic cleanup after processing
- Limited retry attempts
- Configurable request timeouts

## Debugging Tips

### Enable Verbose Logging

```bash
LOG_LEVEL=debug bun run start:dry
```

### Check Configuration

```bash
bun run check-config
```

### Type Checking

```bash
bun run tsc
```

### Inspect Logs

```bash
# View latest logs
cat logs/repo-sync-*.log | tail -100

# Search logs
grep "ERROR" logs/repo-sync-*.log
```

### Test in Isolation

```bash
# Test just configuration loading
bun run check-config

# Preview without changes
bun run start:dry
```

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@octokit/rest` | ^21.0.0 | Official GitHub API client |
| `axios` | ^1.6.8 | HTTP client for Socket.dev API |
| `dotenv` | ^16.4.5 | Environment variable management |
| `@socketsecurity/cli` | ^2.1.0 | Socket.dev CLI integration |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@biomejs/biome` | 2.3.11 | Linter and formatter |
| `typescript` | ^5.9.3 | TypeScript compiler |
| `@types/bun` | ^1.3.5 | Bun type definitions |
| `ultracite` | 7.0.10 | Development tool |

### Adding Dependencies

```bash
# Add runtime dependency
bun add <package-name>

# Add development dependency
bun add --dev <package-name>
```

## Contributing

### Code Style

- Use TypeScript strict mode
- Follow existing naming conventions
- Add JSDoc comments for public functions
- Keep functions focused and small

### Commit Messages

- Be descriptive about what and why
- Use present tense ("add" not "added")
- Reference issues if applicable
- Keep first line under 50 characters

### Pull Request Process

1. Create feature branch from `main`
2. Make changes following code style
3. Test with `bun run start:dry`
4. Run code quality checks: `bun run ci`
5. Commit changes with descriptive message
6. Push and create pull request

## Reusability

This script is designed to be fully reusable for similar tasks:

- **Modular Architecture** - Independent components
- **Configuration-Driven** - Behavior via environment variables
- **Type-Safe** - Full TypeScript strict mode
- **Well-Documented** - Clear code and comments
- **Extensible** - Easy to add new APIs/workflows

## Useful Resources

- **[Architecture Guide](ARCHITECTURE.md)** - System design details
- **[Usage Reference](USAGE.md)** - Commands and configuration
- **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Error solutions
- **[Quick Start](QUICKSTART.md)** - Getting started
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Bun Documentation**: https://bun.sh/docs
- **Octokit Documentation**: https://octokit.github.io/rest.js/

---

**Quick Links**: [📖 Back to README](../README.md) | [🏗️ Architecture](ARCHITECTURE.md) | [⚙️ Usage Reference](USAGE.md)
