import { CONSTANTS } from "./constants";
import { fileExists } from "./helpers";
import type { Logger } from "./logger";

/**
 * Create socket.yml file in the specified repository path
 */
export async function createSocketYml(
  repoPath: string,
  logger: Logger,
  dryRun: boolean
): Promise<void> {
  const filePath = `${repoPath}/${CONSTANTS.SOCKET_YML_FILENAME}`;

  if (dryRun) {
    logger.debug(`[DRY-RUN] Would create: ${filePath}`);
    return;
  }

  try {
    const content = CONSTANTS.SOCKET_YML_CONTENT;
    await Bun.write(filePath, content);
    logger.debug(`Created ${CONSTANTS.SOCKET_YML_FILENAME} at ${filePath}`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to create ${CONSTANTS.SOCKET_YML_FILENAME}`, err);
    throw err;
  }
}

/**
 * Check if socket.yml already exists in the repository
 */
export function socketYmlExists(repoPath: string): Promise<boolean> {
  const filePath = `${repoPath}/${CONSTANTS.SOCKET_YML_FILENAME}`;
  return fileExists(filePath);
}

/**
 * Get the socket.yml content
 */
export function getSocketYmlContent(): string {
  return CONSTANTS.SOCKET_YML_CONTENT;
}

/**
 * Verify socket.yml was created successfully
 */
export async function verifySocketYml(
  repoPath: string,
  logger: Logger
): Promise<boolean> {
  try {
    const exists = await socketYmlExists(repoPath);
    if (!exists) {
      logger.warn(
        `${CONSTANTS.SOCKET_YML_FILENAME} does not exist at ${repoPath}`
      );
      return false;
    }

    const filePath = `${repoPath}/${CONSTANTS.SOCKET_YML_FILENAME}`;
    const file = Bun.file(filePath);
    const content = await file.text();

    if (content.trim() !== CONSTANTS.SOCKET_YML_CONTENT.trim()) {
      logger.warn(
        `${CONSTANTS.SOCKET_YML_FILENAME} content does not match expected format`
      );
      return false;
    }

    logger.debug(`Verified ${CONSTANTS.SOCKET_YML_FILENAME} content`);
    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to verify ${CONSTANTS.SOCKET_YML_FILENAME}`, err);
    return false;
  }
}
