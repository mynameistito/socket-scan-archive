# Getting Started with Repository Sync Orchestrator

## 5-Minute Setup

### Step 1: Get Your Tokens (2 minutes)

**GitHub Personal Access Token:**
1. Visit https://github.com/settings/tokens/new
2. Give it a name like "Socket Scan"
3. Select scope: `repo` (full control of private repositories)
4. Click "Generate token"
5. Copy the token (you won't see it again!)

**Socket.dev API Token:**
1. Visit https://socket.dev/account/settings
2. Find "API Keys" or "API Tokens"
3. Generate a new token
4. Copy the token

### Step 2: Configure Environment (1 minute)

```bash
cp .env.example .env
```

Edit `.env`:
```env
GITHUB_TOKEN=ghp_paste_your_github_token_here
SOCKET_API_TOKEN=paste_your_socket_token_here
GITHUB_ORG=KillzoneGaming
```

### Step 3: Test Configuration (1 minute)

```bash
bun run check-config
```

If all green ✅, you're ready!

### Step 4: Preview Changes (1 minute)

```bash
bun run start:dry
```

This shows what would happen without making changes.

## Running the Script

### Dry-Run Mode (Preview)
```bash
bun run start:dry
```
- Shows what would be processed
- No actual changes made
- Safe to run anytime

### Production Mode (Execute)
```bash
bun run start
```
- Processes all archived repositories
- Makes actual changes (clones, commits, pushes)
- Check output carefully

## Understanding the Output

### Sample Output:
```
[INFO] 2025-01-10T15:30:00Z - Starting Repository Sync Orchestrator
[INFO] 2025-01-10T15:30:02Z - Found 5 archived repositories
[INFO] 2025-01-10T15:30:03Z - [1/5] Processing repository: kzg-old-project
[SUCCESS] 2025-01-10T15:30:36Z - Repository completed: kzg-old-project (33.2s)

═══════════════════════════════════════════════════════════
                    SUMMARY REPORT
═══════════════════════════════════════════════════════════
  📊  Total Archived Repositories: 5
  ✅  Successfully Processed: 5
  ❌  Failed: 0
  ⏱️   Total Duration: 2m 14s
═══════════════════════════════════════════════════════════
```

### What Each Line Means:
- `[INFO]` - Informational message
- `[SUCCESS]` - Operation completed successfully
- `[ERROR]` - Something went wrong
- `[DEBUG]` - Detailed troubleshooting info
- `[WARN]` - Warning, but continuing

## Troubleshooting

### "Configuration Validation Failed"
```
❌ Configuration Validation Failed:

1. GITHUB_TOKEN environment variable is required
```
**Fix:** Make sure `.env` file exists with `GITHUB_TOKEN` set.

### "Authentication failed"
```
[ERROR] GitHub authentication failed
```
**Fixes:**
1. Check token hasn't expired (https://github.com/settings/tokens)
2. Verify token has `repo` scope
3. Check `.env` doesn't have extra spaces: `GITHUB_TOKEN=ghp_xxx...` (no quotes)

### "Organization not found"
```
[ERROR] Organization KillzoneGaming not found
```
**Fixes:**
1. Verify spelling matches your GitHub org exactly
2. Check you have access to the organization
3. Update `GITHUB_ORG` in `.env`

### "No archived repositories found"
This is normal if:
- You don't have any archived repositories yet
- The organization name is wrong
- Your token doesn't have access to the org

### "Push failed"
```
[ERROR] Git push failed: rejected
```
**Fixes:**
1. Make sure main branch exists
2. Verify you have write access
3. Check no branch protection rules block commits
4. Run `git config user.name` and `git config user.email` locally first

## Understanding What It Does

### For Each Repository:
1. **Clone** - Downloads the repo to temporary directory
2. **Create socket.yml** - Adds configuration file:
   ```yaml
   version: 2
   githubApp:
     enabled: false
   ```
3. **Commit** - Creates git commit with message: "Add Socket.yml configuration for security scanning"
4. **List Scans** - Fetches scans from Socket.dev
5. **Delete Scans** - Removes all Socket.dev scans for that repo
6. **Push** - Uploads changes to main branch
7. **Cleanup** - Deletes temporary files

### Duration
- Small repos: 10-30 seconds each
- With many scans: 30-60 seconds each
- Total depends on number of archived repos

## Common Scenarios

### I want to process just one repository
Edit `.env` temporarily or check the script can handle single repos (it can).

### I want to change the commit message
Edit `CONSTANTS.COMMIT_MESSAGE` in `scripts/utils/constants.ts`

### I want to process different organization
Change `GITHUB_ORG` in `.env`:
```env
GITHUB_ORG=MyOtherOrg
```

### I want more detailed logs
Set log level in `.env`:
```env
LOG_LEVEL=debug
```

### Where are the logs saved?
Check `logs/` directory - new file created each run with timestamp.

## Next Steps

1. ✅ Verify tokens work with `bun run check-config`
2. 🔍 Preview with `bun run start:dry`
3. 🚀 Execute with `bun run start`
4. 📊 Check results in summary report
5. 📝 Review detailed logs in `logs/` directory

## Need Help?

1. **Check the logs**: `logs/repo-sync-*.log` has all details
2. **Run in debug mode**: `LOG_LEVEL=debug bun run start`
3. **Try dry-run first**: `bun run start:dry`
4. **Verify config**: `bun run check-config`

---

**Questions?** Check ARCHITECTURE.md for technical details or README.md for full documentation.
