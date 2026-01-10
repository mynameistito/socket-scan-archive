# Repository Sync Orchestrator

A comprehensive TypeScript automation tool that synchronizes archived repositories across a GitHub organization with Socket.dev scanning management.

## Features

✨ **Key Capabilities:**
- Automatically discovers all archived repositories in a GitHub organization
- Adds `socket.yml` configuration to each repository
- Creates commits and pushes changes to the main branch
- Manages Socket.dev scans (list and delete)
- Provides detailed structured logging throughout execution
- Supports dry-run mode for safe testing
- Fully reusable modular architecture
- Type-safe with TypeScript strict mode

## Quick Start

### 1. Setup

```bash
# Copy and configure environment variables
cp .env.example .env

# Edit .env with your credentials
# - GITHUB_TOKEN: Your GitHub Personal Access Token
# - SOCKET_API_TOKEN: Your Socket.dev API token
# - GITHUB_ORG: Your organization name (default: KillzoneGaming)
```

### 2. Get Required Tokens

**GitHub Personal Access Token:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (full control of private repositories)
4. Copy the generated token to `GITHUB_TOKEN` in `.env`

**Socket.dev API Token:**
1. Visit https://socket.dev/account/settings
2. Generate or copy your API token
3. Add to `SOCKET_API_TOKEN` in `.env`

### 3. Run the Script

**Dry-run mode (preview without changes):**
```bash
bun run start:dry
```

**Standard mode (process all archived repos):**
```bash
bun run start
```

**Check configuration:**
```bash
bun run check-config
```

## Commands Reference

### NPM/Bun Scripts

| Command | Invocation | Description | Parameters | Example |
|---------|-----------|-------------|-----------|---------|
| **Start (Standard)** | `bun run start` | Process all archived repositories with full execution | None | `bun run start` |
| **Start (Dry-Run)** | `bun run start:dry` | Preview changes without making modifications | None | `bun run start:dry` |
| **Check Config** | `bun run check-config` | Validate configuration and environment variables | None | `bun run check-config` |
| **Format Code** | `bun run fix` | Fix code formatting issues using ultracite | None | `bun run fix` |
| **Lint** | `bun run lint` | Check code quality and style issues | None | `bun run lint` |
| **CI Check** | `bun run ci` | Run Biome CI checks | None | `bun run ci` |
| **TypeScript Check** | `bun run tsc` | Compile TypeScript without emitting files | None | `bun run tsc` |

### CLI Flags

| Flag | Type | Description | Usage | Example |
|------|------|-------------|-------|---------|
| `--dry-run` | Boolean | Run in preview mode without making changes | Use with `bun run start` or as script flag | `bun run start -- --dry-run` |
| `--check-config` | Boolean | Validate configuration and exit | Use with `bun run start` or as script flag | `bun run start -- --check-config` |

### Command Details

#### Execution Commands

**`bun run start`**
- Executes full repository synchronization
- Processes all archived repositories
- Creates `socket.yml` files
- Manages Socket.dev scans
- Generates comprehensive logs
- Creates git commits and pushes changes

**`bun run start:dry`**
- Equivalent to `bun run start -- --dry-run`
- Shows what would be cloned
- Simulates file creation
- Displays git commands that would execute
- Logs API operations without executing them
- Does NOT make actual changes

**`bun run start -- --check-config`**
- Equivalent to `bun run check-config`
- Validates all environment variables
- Verifies token formats
- Checks configuration completeness
- Exits after validation (does not process repos)

#### Development Commands

**`bun run fix`**
- Fixes code formatting issues
- Uses ultracite formatter
- Automatically corrects style violations
- Should be run before committing code

**`bun run lint`**
- Checks code quality
- Identifies style violations
- Uses ultracite linter
- Does not modify files

**`bun run ci`**
- Runs Biome CI checks
- Comprehensive code quality checks
- Used in CI/CD pipelines
- Ensures code meets project standards

**`bun run tsc`**
- Validates TypeScript compilation
- Checks for type errors
- Does not emit compiled files
- Useful for development validation

## Configuration

### Environment Variables (.env)

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `GITHUB_TOKEN` | Yes | N/A | GitHub Personal Access Token | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `GITHUB_ORG` | Yes | N/A | GitHub organization name | `KillzoneGaming` |
| `SOCKET_API_TOKEN` | Yes | N/A | Socket.dev API authentication token | `sk_live_xxxxxxxxxxxx` |
| `REPOS_BASE_PATH` | No | `./temp-repos` | Local directory for temporary repo clones | `./temp-repos` |
| `DRY_RUN` | No | `false` | Enable dry-run mode | `true` or `false` |
| `SOCKET_BASE_URL` | No | `https://api.socket.dev/v0` | Socket.dev API endpoint | `https://api.socket.dev/v0` |
| `GITHUB_BASE_URL` | No | `https://api.github.com` | GitHub API endpoint | `https://api.github.com` |
| `LOG_LEVEL` | No | `info` | Logging verbosity level | `debug`, `info`, `warn`, `error` |

### Example .env File

```env
# Required
GITHUB_TOKEN=ghp_your_token_here
GITHUB_ORG=KillzoneGaming
SOCKET_API_TOKEN=your_socket_token_here

# Optional (uses defaults if not specified)
REPOS_BASE_PATH=./temp-repos
DRY_RUN=false
LOG_LEVEL=info
SOCKET_BASE_URL=https://api.socket.dev/v0
GITHUB_BASE_URL=https://api.github.com
```

## Directory Structure

```
socket-scan/
├── scripts/
│   ├── repo-sync-orchestrator.ts      # Main entry point
│   ├── github/
│   │   └── client.ts                  # GitHub API client
│   ├── socket/
│   │   └── client.ts                  # Socket.dev API client
│   ├── git/
│   │   └── operations.ts              # Git command wrapper
│   ├── types/
│   │   └── index.ts                   # TypeScript interfaces
│   └── utils/
│       ├── logger.ts                  # Structured logging
│       ├── config.ts                  # Configuration management
│       ├── file-operations.ts         # socket.yml handler
│       ├── helpers.ts                 # Utility functions
│       └── constants.ts               # Constants & defaults
├── logs/                              # Generated log files
├── package.json
├── tsconfig.json
├── biome.jsonc
└── README.md
```

## Execution Flow

The script follows a systematic process to synchronize repositories:

1. **Parse Arguments** - Extract CLI flags (`--dry-run`, `--check-config`)
2. **Load Configuration** - Parse environment variables and validate tokens
3. **Verify Authentication** - Test GitHub and Socket.dev API access
4. **Verify Organization** - Confirm organization exists and is accessible
5. **Fetch Repositories** - Get all archived repositories from the organization
6. **Process Each Repository:**
   - Clone repository to temporary directory
   - Create/verify `socket.yml` configuration file:
     ```yaml
     version: 2
     githubApp:
       enabled: false
     ```
   - Stage and commit changes to git
   - List Socket.dev scans for the repository
   - Delete all identified scans from Socket.dev
   - Push changes to main branch
   - Clean up temporary directory
7. **Generate Summary Report** - Display success/failure statistics
8. **Save Logs** - Write detailed logs to file with timestamp

## Output & Logging

### Console Output Example

```
[INFO] 2025-01-10T15:30:00Z - Starting Repository Sync Orchestrator
[INFO] 2025-01-10T15:30:01Z - Configuration loaded successfully
[SUCCESS] 2025-01-10T15:30:02Z - Found 5 archived repositories
[INFO] 2025-01-10T15:30:03Z - [1/5] Processing repository: kzg-archived-repo-1
[DEBUG] 2025-01-10T15:30:04Z - Cloning repository...
[SUCCESS] 2025-01-10T15:30:08Z - Repository cloned (4.2s)
...
═══════════════════════════════════════════════════════════
                     SUMMARY REPORT
═══════════════════════════════════════════════════════════
   📊  Total Archived Repositories: 5
   ✅  Successfully Processed: 5
   ❌  Failed: 0
   ⏱️   Total Duration: 2m 14s
═══════════════════════════════════════════════════════════
```

### Log Files

Detailed logs are automatically saved to: `logs/repo-sync-{timestamp}.log`

**Log Contents:**
- Complete operation timeline
- Full error stack traces
- API call details
- Configuration summary
- Timing information for each step
- Detailed progress for each repository

### Dry-Run Mode

Use `bun run start:dry` or `bun run start -- --dry-run` to preview changes without modifications:

**Dry-run behavior:**
- Shows what would be cloned
- Simulates file creation
- Displays git commands that would execute
- Logs Socket.dev API operations
- Does NOT make actual changes to repositories
- Safe for testing configuration

## Error Handling

The script includes robust error handling for various failure scenarios:

| Error Type | Strategy | Action | Outcome |
|-----------|----------|--------|---------|
| Network failures | Retry with exponential backoff (3 attempts) | Automatic retry | Skip repo if all retries fail |
| Git conflicts | Graceful abort | Log error with details | Continue processing next repo |
| Auth failures (GitHub/Socket) | Immediate stop | Clear error message | Exit with status code 1 |
| API rate limits | Wait and retry | Exponential backoff delays | Resume after limit resets |
| File system errors | Log and continue | Log full error | Skip problematic step, continue |
| Missing required tokens | Validation on startup | Exit with guidance | Inform user of missing config |

## Core Modules

### GitHubClient (`scripts/github/client.ts`)
**Responsibilities:**
- Lists archived repositories in the organization
- Verifies GitHub authentication and token validity
- Confirms organization exists and is accessible
- Handles GitHub API pagination
- Manages API rate limiting

**Key Methods:**
- `verifyAuth()` - Validates GitHub token
- `verifyOrganization()` - Confirms org access
- `listArchivedRepositories()` - Fetch all archived repos

### SocketClient (`scripts/socket/client.ts`)
**Responsibilities:**
- Lists scans for a specific repository
- Deletes scans by ID
- Supports batch deletion operations
- Verifies Socket.dev authentication
- Includes retry logic for transient failures

**Key Methods:**
- `verifyAuth()` - Validates Socket API token
- `listScans(repoId)` - Get scans for repository
- `deleteScan(scanId)` - Delete specific scan

### GitOperations (`scripts/git/operations.ts`)
**Responsibilities:**
- Clones repositories using system `git` commands
- Stages files for commit
- Creates commits with custom messages
- Pushes to main branch with retry logic
- Retrieves branch information

**Key Methods:**
- `clone(repoUrl, path)` - Clone repository
- `stageFiles(path)` - Stage changes
- `commit(path, message)` - Create commit
- `push(path)` - Push to remote

### Logger (`scripts/utils/logger.ts`)
**Responsibilities:**
- Structured timestamped logging
- Multiple log levels (debug, info, warn, error, success)
- Color-coded console output
- File-based detailed logging
- Step timing and progress tracking

**Log Levels:**
- `debug` - Detailed technical information
- `info` - General informational messages
- `warn` - Warning messages
- `error` - Error messages
- `success` - Success confirmation messages

## Development

### Setup Development Environment

```bash
# Install dependencies
bun install

# Verify TypeScript compilation
bun run tsc

# Check code quality
bun run lint
```

### Code Management

| Task | Command | Purpose |
|------|---------|---------|
| Format code | `bun run fix` | Fix code style and formatting issues |
| Lint code | `bun run lint` | Check for code quality violations |
| Type check | `bun run tsc` | Validate TypeScript compilation |
| CI checks | `bun run ci` | Run Biome CI checks |

### Add Dependencies

```bash
bun add <package-name>
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

## Reusability

This script is designed to be fully reusable for similar tasks:

- **Modular Architecture** - Each component (GitHub, Socket, Git, Logger) is independent
- **Configuration-Driven** - Behavior controlled via environment variables
- **Type-Safe** - Full TypeScript strict mode compliance
- **Well-Documented** - Clear code with comprehensive comments
- **Extensible** - Easy to add new API clients or workflows

## Troubleshooting

### Configuration Issues

**Problem: "Configuration is invalid"**
```bash
# Solution: Verify your configuration
bun run check-config
```
- Ensure all required environment variables are set
- Check for extra whitespace in token values
- Verify `.env` file exists and is readable

### Authentication Failures

**GitHub Token Issues:**
- Verify token hasn't expired
- Check token has `repo` scope (full control of private repositories)
- Confirm token format starts with `ghp_`
- Ensure no extra whitespace in `.env`
- Verify token is in `GITHUB_TOKEN` variable

**Socket.dev Token Issues:**
- Verify token from https://socket.dev/account/settings
- Check token is still active and not revoked
- Confirm API permissions are enabled
- Test token format and validity

### No Repositories Found

| Issue | Check | Solution |
|-------|-------|----------|
| No archived repos listed | Organization name | Verify `GITHUB_ORG` matches exactly |
| Access denied | Organization membership | Confirm you have access to the org |
| No repos exist | Repository state | Ensure there are archived repositories |

**Debug:**
```bash
LOG_LEVEL=debug bun run start:dry
```

### Push Failures

**Problem: "Permission denied" or push fails**
- Verify git is properly configured:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your@email.com"
  ```
- Check write access to repositories
- Verify no branch protection rules block commits to main
- Ensure GitHub token has `repo` scope

### Socket.dev API Errors

**Problem: "Socket API error" or scan deletion fails**
- Verify `SOCKET_API_TOKEN` is correct
- Check if rate limits have been exceeded
- Verify Socket.dev API is accessible
- Try again after a short delay

### Debugging Commands

| Command | Purpose |
|---------|---------|
| `LOG_LEVEL=debug bun run start:dry` | Preview with verbose logging |
| `bun run check-config` | Validate configuration |
| `bun run tsc` | Check for TypeScript errors |
| `cat logs/repo-sync-*.log` | Review detailed execution logs |

### Getting Help

1. Check detailed logs: `ls -la logs/`
2. Review recent log file: `cat logs/repo-sync-latest.log`
3. Run configuration check: `bun run check-config`
4. Test with dry-run: `bun run start:dry`
5. Enable debug logging: `LOG_LEVEL=debug bun run start:dry`

## Disclaimer

**User Assumes All Responsibility**

This code is provided as-is without any warranties. The user assumes full responsibility for using this software. The code may contain bugs, errors, or other issues. The author takes no responsibility for any damages, data loss, or issues arising from the use of this software. Use at your own risk.

## License

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
