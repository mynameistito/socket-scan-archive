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

## Directory Structure

```
packages/socket-scan/
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
├── biome.json
└── README.md
```

## Configuration

### Environment Variables (.env)

```env
# GitHub Configuration (Required)
GITHUB_TOKEN=ghp_your_token_here
GITHUB_ORG=KillzoneGaming

# Socket.dev Configuration (Required)
SOCKET_API_TOKEN=your_socket_token_here

# Local Configuration
REPOS_BASE_PATH=./temp-repos
DRY_RUN=false

# Optional API Endpoints
SOCKET_BASE_URL=https://api.socket.dev/v0
GITHUB_BASE_URL=https://api.github.com

# Logging
LOG_LEVEL=info  # Options: debug, info, warn, error
```

## Execution Flow

1. **Load Configuration** - Parse environment variables and validate tokens
2. **Verify Authentication** - Test GitHub and Socket.dev API access
3. **Fetch Repositories** - Get all archived repos from organization
4. **Process Each Repository:**
   - Clone repository to temporary directory
   - Create `socket.yml` with configuration:
     ```yaml
     version: 2
     githubApp:
       enabled: false
     ```
   - Stage and commit changes
   - List Socket.dev scans for the repo
   - Delete all identified scans
   - Push changes to main branch
   - Clean up temporary directory
5. **Generate Report** - Create summary with success/failure statistics
6. **Save Logs** - Write detailed logs to file with timestamp

## Output

### Console Output

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

Detailed logs are saved to: `logs/repo-sync-{timestamp}.log`

Contains:
- Complete operation timeline
- Full error stack traces
- API call details
- Configuration summary
- Timing information for each step

## Dry-Run Mode

Run with `--dry-run` flag to preview changes without making modifications:

```bash
bun run start:dry
```

**Dry-run behavior:**
- Shows what would be cloned
- Simulates file creation
- Displays git commands that would execute
- Logs Socket.dev API operations
- Does NOT make actual changes

## Error Handling

The script includes robust error handling:

| Error Type | Strategy | Action |
|-----------|----------|---------|
| Network failures | Retry with exponential backoff (3 attempts) | Skip repo if all fail |
| Git conflicts | Graceful abort | Log error, continue to next repo |
| Auth failures (GitHub/Socket) | Immediate stop | Exit with clear error message |
| API rate limits | Wait and retry | Exponential backoff |
| File system errors | Log and continue | Skip problematic step |

## API Modules

### GitHubClient
- Lists archived repositories in organization
- Verifies authentication and organization access
- Handles pagination and rate limiting

### SocketClient
- Lists scans for a repository
- Deletes scans by ID
- Supports batch deletion operations
- Includes retry logic for transient failures

### GitOperations
- Clones repositories using pure `git` commands
- Stages files for commit
- Creates commits with custom messages
- Pushes to main branch with retry logic
- Retrieves branch information

### Logger
- Structured timestamped logging
- Multiple log levels (debug, info, warn, error, success)
- Color-coded console output
- File-based detailed logging
- Step timing and progress tracking

## Development

### Add Dependencies

```bash
cd packages/socket-scan
bun add <package-name>
```

### Format Code

```bash
bun run fix
```

### Check Code Quality

```bash
bun run lint
```

## Reusability

This script is designed to be fully reusable for similar tasks:

- **Modular Architecture** - Each component (GitHub, Socket, Git, Logger) is independent
- **Configuration-Driven** - Behavior controlled via environment variables
- **Type-Safe** - Full TypeScript strict mode compliance
- **Well-Documented** - Clear code with comprehensive comments
- **Extensible** - Easy to add new API clients or workflows

## Troubleshooting

### Authentication Failures

**GitHub Token Issues:**
- Verify token hasn't expired
- Check token has `repo` scope
- Confirm token is in `.env` without extra whitespace

**Socket.dev Token Issues:**
- Verify token from https://socket.dev/account/settings
- Check token is still active
- Confirm API permissions are enabled

### No Repositories Found

- Verify `GITHUB_ORG` matches your organization name
- Check that you have access to the organization
- Ensure there are actually archived repositories

### Push Failures

- Verify git is properly configured (`git config user.name`, `git config user.email`)
- Check that you have write access to repositories
- Ensure no branch protection rules block commits to main

### Socket.dev API Errors

- Verify `SOCKET_API_TOKEN` is correct
- Check rate limits haven't been exceeded
- Verify Socket.dev API is accessible

## Support

For issues or questions:
1. Check the detailed logs in `logs/` directory
2. Run with `LOG_LEVEL=debug` for more verbose output
3. Test with `--dry-run` flag first
4. Run `bun run check-config` to verify configuration

## Disclaimer

**User Assumes All Responsibility**

This code is provided as-is without any warranties. The user assumes full responsibility for using this software. The code may contain bugs, errors, or other issues. The author takes no responsibility for any damages, data loss, or issues arising from the use of this software. Use at your own risk.

## License

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
