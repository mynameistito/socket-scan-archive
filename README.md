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

```bash
# 1. Copy and configure environment variables
cp .env.example .env

# 2. Edit .env with your GitHub and Socket.dev tokens
# GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
# SOCKET_API_TOKEN=sk_live_xxxxxxxxxxxx
# GITHUB_ORG=YourOrganization

# 3. Verify configuration
bun run check-config

# 4. Preview changes (dry-run mode)
bun run start:dry

# 5. Execute
bun run start
```

## Documentation

Full documentation is organized in the `/docs` directory:

- **[📖 Quick Start Guide](docs/QUICKSTART.md)** - Get up and running in 5 minutes
- **[⚙️ Usage Reference](docs/USAGE.md)** - Commands, configuration, and CLI flags
- **[🏗️ Architecture](docs/ARCHITECTURE.md)** - System design and technical deep-dive
- **[🔧 Development Guide](docs/DEVELOPMENT.md)** - Setup, code management, and extensibility
- **[❓ Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and debugging
- **[📋 Build Summary](docs/BUILD.md)** - Implementation details and features

## Available Commands

| Command | Purpose |
|---------|---------|
| `bun run start` | Process all archived repositories |
| `bun run start:dry` | Preview changes without making modifications |
| `bun run check-config` | Validate configuration and environment variables |
| `bun run fix` | Auto-format code |
| `bun run lint` | Check code quality |
| `bun run tsc` | Validate TypeScript compilation |

## Core Modules

- **GitHub Client** - Lists and verifies archived repositories
- **Socket.dev Client** - Manages scan listing and deletion
- **Git Operations** - Handles cloning, committing, and pushing
- **Logger** - Structured timestamped logging
- **Configuration** - Environment validation and management

## Requirements

- Node.js/Bun 1.3.4+
- GitHub Personal Access Token (with `repo` scope)
- Socket.dev API Token
- Git installed locally

## Directory Structure

```
socket-scan/
├── scripts/              # TypeScript source code
├── docs/                 # Documentation
├── logs/                 # Generated log files
├── package.json
├── tsconfig.json
├── biome.jsonc
├── .env.example
└── README.md
```

## Error Handling

The script includes robust error handling with:
- Automatic retry logic with exponential backoff
- Graceful degradation (continues on individual repo failure)
- Comprehensive error logging
- Detailed troubleshooting information

See [Troubleshooting Guide](docs/TROUBLESHOOTING.md) for common issues and solutions.

## Development

```bash
# Install dependencies
bun install

# Format code
bun run fix

# Lint code
bun run lint

# Type check
bun run tsc
```

See [Development Guide](docs/DEVELOPMENT.md) for more details.

## Disclaimer

**User Assumes All Responsibility**

This code is provided as-is without any warranties. The user assumes full responsibility for using this software. The code may contain bugs, errors, or other issues. The author takes no responsibility for any damages, data loss, or issues arising from the use of this software. Use at your own risk.

## License

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM THE USE OR OTHER IN THE SOFTWARE.
