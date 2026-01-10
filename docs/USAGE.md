# Usage Reference

Complete reference for all commands, configuration options, and CLI flags.

## Quick Command Summary

| Command | Purpose |
|---------|---------|
| `bun run start` | Process all archived repositories |
| `bun run start:dry` | Preview changes without making modifications |
| `bun run check-config` | Validate configuration and environment variables |
| `bun run fix` | Auto-format code using Biome |
| `bun run lint` | Check code quality |
| `bun run ci` | Run Biome CI checks |
| `bun run tsc` | Validate TypeScript compilation |

## Execution Commands

### `bun run start`
- Executes full repository synchronization
- Processes all archived repositories
- Creates `socket.yml` files
- Manages Socket.dev scans
- Generates comprehensive logs
- Creates git commits and pushes changes

### `bun run start:dry`
- Equivalent to `bun run start -- --dry-run`
- Shows what would be cloned
- Simulates file creation
- Displays git commands that would execute
- Logs API operations without executing them
- Does NOT make actual changes

### `bun run start -- --check-config`
- Equivalent to `bun run check-config`
- Validates all environment variables
- Verifies token formats
- Checks configuration completeness
- Exits after validation (does not process repos)

## Development Commands

### `bun run fix`
- Fixes code formatting issues
- Uses Biome formatter
- Automatically corrects style violations
- Should be run before committing code

### `bun run lint`
- Checks code quality
- Identifies style violations
- Uses Biome linter
- Does not modify files

### `bun run ci`
- Runs Biome CI checks
- Comprehensive code quality checks
- Used in CI/CD pipelines
- Ensures code meets project standards

### `bun run tsc`
- Validates TypeScript compilation
- Checks for type errors
- Does not emit compiled files
- Useful for development validation

## CLI Flags

| Flag | Type | Description | Example |
|------|------|-------------|---------|
| `--dry-run` | Boolean | Run in preview mode without making changes | `bun run start -- --dry-run` |
| `--check-config` | Boolean | Validate configuration and exit | `bun run start -- --check-config` |

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `SOCKET_API_TOKEN` | Socket.dev API authentication token | `sk_live_xxxxxxxxxxxx` |
| `GITHUB_ORG` | GitHub organization name | `KillzoneGaming` |

### Optional Variables

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `REPOS_BASE_PATH` | `./temp-repos` | Local directory for temporary repo clones | `./temp-repos` |
| `DRY_RUN` | `false` | Enable dry-run mode | `true` or `false` |
| `SOCKET_BASE_URL` | `https://api.socket.dev/v0` | Socket.dev API endpoint | `https://api.socket.dev/v0` |
| `GITHUB_BASE_URL` | `https://api.github.com` | GitHub API endpoint | `https://api.github.com` |
| `LOG_LEVEL` | `info` | Logging verbosity level | `debug`, `info`, `warn`, `error` |

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

## Configuration

### Loading Configuration

Configuration is loaded from `.env` file using `dotenv`:

```bash
cp .env.example .env
# Edit .env with your values
```

### Validating Configuration

```bash
bun run check-config
```

This validates:
- All required environment variables are set
- Token formats are valid
- Organization name is properly formatted
- API URLs are correctly formatted

### GitHub Personal Access Token

**Classic Token Setup:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select **required scopes**:
   - `repo` (full control of private repositories)
   - `admin:repo_hook` (required for unarchiving repositories)
4. Copy the generated token to `GITHUB_TOKEN` in `.env`

**Fine-Grained Token Setup (Recommended):**
1. Go to https://github.com/settings/tokens?type=beta
2. Create a new fine-grained token
3. Select required permissions: **"Administration" (write)** on repositories
4. This is more secure than classic tokens with broad scopes

### Socket.dev API Token

1. Visit https://socket.dev/account/settings
2. Generate or copy your API token
3. Add to `SOCKET_API_TOKEN` in `.env`

## Output & Logging

### Console Output

The script provides real-time console output with:
- Timestamped messages
- Color-coded log levels
- Progress indicators
- Summary statistics

**Example Output:**
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

### Log Levels

| Level | Description | When to Use |
|-------|-------------|------------|
| `debug` | Detailed technical information | Troubleshooting issues |
| `info` | General informational messages | Normal operation |
| `warn` | Warning messages | Potential issues |
| `error` | Error messages | Operation failures |
| `success` | Success confirmation messages | Operation completions |

### Log Files

Detailed logs are automatically saved to: `logs/repo-sync-{timestamp}.log`

**Log Contents:**
- Complete operation timeline
- Full error stack traces
- API call details
- Configuration summary
- Timing information for each step
- Detailed progress for each repository

**Accessing Logs:**
```bash
# List all log files
ls -la logs/

# View latest log
cat logs/repo-sync-*.log | tail -100

# Search logs for specific error
grep "ERROR" logs/repo-sync-*.log
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

## Dry-Run Mode

Use `bun run start:dry` or `bun run start -- --dry-run` to preview changes without modifications:

**Dry-run behavior:**
- Shows what would be cloned
- Simulates file creation
- Displays git commands that would execute
- Logs Socket.dev API operations
- Does NOT make actual changes to repositories
- Safe for testing configuration

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
├── docs/                              # Documentation
├── logs/                              # Generated log files
├── package.json
├── tsconfig.json
├── biome.jsonc
└── README.md
```

## Tips & Tricks

### Change Log Level at Runtime
```bash
LOG_LEVEL=debug bun run start:dry
```

### Process Different Organization
```bash
GITHUB_ORG=MyOtherOrg bun run start:dry
```

### Use Custom Repository Directory
```bash
REPOS_BASE_PATH=/tmp/my-repos bun run start
```

### Override Socket.dev Endpoint
```bash
SOCKET_BASE_URL=https://custom.socket.dev/v0 bun run start
```

## Related Documentation

- **[📖 Quick Start](QUICKSTART.md)** - Get started in 5 minutes
- **[❓ Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
- **[🏗️ Architecture](ARCHITECTURE.md)** - System design and modules
- **[🔧 Development](DEVELOPMENT.md)** - Development setup and contribution

---

**Quick Links**: [📖 Back to README](../README.md) | [📖 Quick Start](QUICKSTART.md) | [🏗️ Architecture](ARCHITECTURE.md)
