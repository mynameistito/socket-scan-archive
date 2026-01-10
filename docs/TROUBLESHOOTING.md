# Troubleshooting Guide

Common issues, error solutions, and debugging strategies.

## Error Handling Overview

The script includes robust error handling for various failure scenarios:

| Error Type | Strategy | Action | Outcome |
|-----------|----------|--------|---------|
| Network failures | Retry with exponential backoff (3 attempts) | Automatic retry | Skip repo if all retries fail |
| Git conflicts | Graceful abort | Log error with details | Continue processing next repo |
| Auth failures (GitHub/Socket) | Immediate stop | Clear error message | Exit with status code 1 |
| API rate limits | Wait and retry | Exponential backoff delays | Resume after limit resets |
| File system errors | Log and continue | Log full error | Skip problematic step, continue |
| Missing required tokens | Validation on startup | Exit with guidance | Inform user of missing config |

## Configuration Issues

### Problem: "Configuration Validation Failed"

**Error Message:**
```
❌ Configuration Validation Failed:
1. GITHUB_TOKEN environment variable is required
```

**Solutions:**
1. Verify `.env` file exists in the project root
2. Check all required variables are set:
   ```bash
   bun run check-config
   ```
3. Ensure no typos in variable names (case-sensitive)
4. Check file is readable and not locked

**Debug:**
```bash
# Show what configuration values are being loaded
LOG_LEVEL=debug bun run check-config
```

## Authentication Failures

### GitHub Token Issues

**Problem: "GitHub authentication failed"**
```
[ERROR] GitHub authentication failed
```

**Fixes:**
1. Check token hasn't expired
   - Visit https://github.com/settings/tokens
   - Regenerate if needed
2. Verify token has `repo` scope
   - For classic tokens: `repo` (full control of private repositories)
   - For fine-grained tokens: "Administration" (write) on repositories
3. Check `.env` doesn't have extra spaces
   - Correct: `GITHUB_TOKEN=ghp_xxx...` (no quotes)
   - Incorrect: `GITHUB_TOKEN = "ghp_xxx..."` (extra spaces/quotes)
4. Ensure no whitespace before/after token value
5. Verify token format starts with `ghp_` (classic) or `ghu_` (fine-grained)

**Debug:**
```bash
# Test GitHub connection directly
curl -H "Authorization: token YOUR_GITHUB_TOKEN" https://api.github.com/user
```

### Socket.dev Token Issues

**Problem: "Socket API authentication failed"**
```
[ERROR] Socket.dev authentication failed
```

**Fixes:**
1. Verify token from https://socket.dev/account/settings
2. Check token is still active and not revoked
3. Confirm API permissions are enabled
4. Ensure token format (usually starts with `sk_`)
5. Check for extra whitespace in `.env`
6. Verify token hasn't expired

**Debug:**
```bash
# Test Socket.dev API directly
curl -H "Authorization: Bearer YOUR_SOCKET_API_TOKEN" https://api.socket.dev/v0/scans
```

## Organization & Repository Issues

### Problem: "Organization not found"

**Error Message:**
```
[ERROR] Organization KillzoneGaming not found
```

**Fixes:**
1. Verify spelling matches your GitHub org exactly (case-sensitive)
2. Check you have access to the organization
3. Update `GITHUB_ORG` in `.env`
4. Ensure it's an organization, not a personal user account

**Debug:**
```bash
# Test organization access
curl -H "Authorization: token YOUR_GITHUB_TOKEN" https://api.github.com/orgs/YourOrg
```

### Problem: "No archived repositories found"

This is normal if:
- You don't have any archived repositories yet
- The organization name is wrong
- Your token doesn't have access to the org
- No repositories are actually archived

**Verify:**
```bash
# Check what repos exist and their status
LOG_LEVEL=debug bun run start:dry
```

## Git & Push Failures

### Problem: "Temporary directory already exists"

**Error Message:**
```
fatal: destination path './temp-repos/repo-name' already exists and is not an empty directory
```

This happens when a previous run crashed before cleanup could remove the temp directory.

**Solutions:**
1. **Manual cleanup** (quickest):
   ```bash
   rm -rf ./temp-repos
   ```

2. **Automatic cleanup** (next run):
   - The script automatically cleans up before running
   - Just run again: `bun run start`

**Prevention:**
- Ensure previous runs completed successfully
- Monitor disk space for temp directory

### Problem: "Push failed - rejected"

**Error Message:**
```
[ERROR] Git push failed: rejected
```

**Fixes:**
1. Make sure main branch exists
2. Verify you have write access to repositories
3. Check no branch protection rules block commits to main
4. Verify git is configured locally:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your@email.com"
   ```
5. Check GitHub token has `repo` scope

### Problem: "Cannot push to archived repository"

**Error Message:**
```
ERROR: This repository was archived so it is read-only
```

This error occurs because GitHub prevents writes to archived repositories.

**Solutions:**

**Option 1: Unarchive Before Processing (Recommended)**
1. Manually unarchive the repository on GitHub
   - Go to Settings → Danger Zone → Unarchive this repository
2. Run the script to process the repository
3. Manually rearchive when done

**Option 2: Use Fine-Grained Token with Admin Access**
- Ensure your GitHub token has the `admin:repo_hook` scope or
- Use a fine-grained token with "Administration" write permissions
- This allows automatic unarchive/rearchive (if implemented)

**Debug:**
```bash
# Check which repos are archived
LOG_LEVEL=debug bun run start:dry
```

## Socket.dev API Errors

### Problem: "Socket API error 404"

**Error Message:**
```
[ERROR] Socket API error 404 - API route not found
```

This can happen for several reasons:

**Causes:**
1. Incorrect API Endpoint - `/api/v0/scans` endpoint may not exist
2. Organization Not Registered - Your org may not be properly set up with Socket.dev
3. Invalid API Token - Token may be incorrect or expired
4. Rate Limits Exceeded - API rate limits may have been hit

**Troubleshooting Steps:**
1. Verify token: `SOCKET_API_TOKEN` should start with `sk_`
2. Test Socket.dev API directly:
   ```bash
   curl -H "Authorization: Bearer $SOCKET_API_TOKEN" https://api.socket.dev/v0/scans
   ```
3. Check organization settings at https://socket.dev/account/settings
4. Confirm your organization is properly onboarded with Socket.dev
5. Review Socket.dev documentation for correct API usage

**Current Behavior:**
- The script continues processing even if Socket.dev operations fail
- Scan deletion is non-critical to the main workflow
- Check logs for detailed error information

### Problem: "Socket API rate limit exceeded"

**Error Message:**
```
[WARN] Socket.dev API rate limit exceeded, retrying...
```

**Fixes:**
1. Wait for rate limit to reset (typically 1 hour)
2. Reduce number of concurrent operations
3. Increase retry delay in configuration
4. Contact Socket.dev support if limits are too restrictive

## Debugging Commands

### Enable Debug Logging

```bash
LOG_LEVEL=debug bun run start:dry
```

This provides verbose output for all operations including:
- API call details
- Configuration values
- Step timing
- Full error stack traces

### Configuration Validation

```bash
bun run check-config
```

Validates:
- All environment variables are set
- Token formats are valid
- Organization accessibility
- API connectivity

### Test with Dry-Run

```bash
bun run start:dry
```

Safe preview of all operations without making changes.

### Type Checking

```bash
bun run tsc
```

Validates TypeScript compilation and catches type errors.

### Code Quality Check

```bash
bun run lint
```

Checks for code style and quality issues.

## Log Files

Detailed logs are saved automatically to `logs/repo-sync-{timestamp}.log`

### Accessing Logs

```bash
# List all logs
ls -la logs/

# View latest log file
tail -100 logs/repo-sync-*.log

# Search for errors
grep "ERROR" logs/repo-sync-*.log

# View specific portion
cat logs/repo-sync-2025-01-10-153000.log | grep "repo-name"
```

### Log Contents

Each log file contains:
- Complete operation timeline
- Full error stack traces
- API call details
- Configuration summary
- Timing information for each step
- Detailed progress for each repository
- Environment information

## Getting Additional Help

1. **Check detailed logs**
   ```bash
   ls -la logs/
   ```

2. **Review recent log file**
   ```bash
   cat logs/repo-sync-latest.log
   ```

3. **Run configuration check**
   ```bash
   bun run check-config
   ```

4. **Test with dry-run**
   ```bash
   bun run start:dry
   ```

5. **Enable debug logging**
   ```bash
   LOG_LEVEL=debug bun run start:dry
   ```

6. **Check related documentation**
   - [Quick Start Guide](QUICKSTART.md) - Basic setup
   - [Usage Reference](USAGE.md) - Commands and configuration
   - [Architecture Guide](ARCHITECTURE.md) - System design
   - [Development Guide](DEVELOPMENT.md) - Development setup

## Common Scenario Solutions

### "I want to test with just one repo"

Edit `.env` temporarily or the script will process all archived repos in the organization.

**Verify with dry-run first:**
```bash
bun run start:dry
```

### "Push works locally but fails in script"

The script may have different git configuration:

```bash
# Check git config
git config --global user.name
git config --global user.email

# Set if missing
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### "Token works in git but not in script"

GitHub Token issues with script:
1. Check token format (should be `ghp_...`)
2. Check for extra spaces in `.env`
3. Verify scope includes `repo`
4. Try generating a new token

### "Script hangs or runs very slowly"

Possible causes:
1. Network issues - Check internet connection
2. Large repositories - May take longer to clone
3. Many Socket.dev scans - Deletion takes time
4. API rate limiting - Script will retry automatically

**Debug:**
```bash
LOG_LEVEL=debug bun run start:dry
```

## Performance Considerations

### Processing Times

- Small repos: 10-30 seconds each
- Repos with many scans: 30-60 seconds each
- Total time depends on:
  - Number of archived repositories
  - Repository sizes
  - Number of Socket.dev scans
  - Network speed
  - API response times

### Optimization

1. Process during off-peak hours
2. Start with dry-run to estimate time
3. Check logs for slow operations
4. Review API rate limits if needed

## Still Need Help?

If you've tried all solutions above:

1. Enable debug logging:
   ```bash
   LOG_LEVEL=debug bun run start:dry > debug.log 2>&1
   ```

2. Save the debug log for review:
   ```bash
   cat debug.log
   ```

3. Check the full logs directory:
   ```bash
   ls -la logs/
   ```

4. Review the [Architecture Guide](ARCHITECTURE.md) for system details

5. Check the [Development Guide](DEVELOPMENT.md) for extending functionality

---

**Quick Links**: [📖 Back to README](../README.md) | [📖 Quick Start](QUICKSTART.md) | [⚙️ Usage Reference](USAGE.md)
