import type { LogEntry } from "../types/index";

const COLORS = {
  reset: "\x1b[0m",
  debug: "\x1b[36m", // cyan
  info: "\x1b[34m", // blue
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  success: "\x1b[32m", // green
};

export class Logger {
  private readonly logs: LogEntry[] = [];
  private readonly logLevel: "debug" | "info" | "warn" | "error" = "info";
  private currentStep: { name: string; startTime: number } | null = null;

  constructor(logLevel: "debug" | "info" | "warn" | "error" = "info") {
    this.logLevel = logLevel;
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString();
  }

  private shouldLog(level: string): boolean {
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private logToConsole(
    level: "debug" | "info" | "warn" | "error" | "success",
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = this.formatTimestamp(new Date());
    const color = COLORS[level] || COLORS.info;
    const levelUpper = level.toUpperCase();

    let output = `${color}[${levelUpper}]${COLORS.reset} ${timestamp} - ${message}`;

    if (metadata && Object.keys(metadata).length > 0) {
      output += ` ${JSON.stringify(metadata)}`;
    }

    console.log(output);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("info")) {
      return;
    }
    this.logToConsole("info", message, metadata);
    this.logs.push({
      level: "info",
      message,
      timestamp: new Date(),
      metadata,
    });
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("warn")) {
      return;
    }
    this.logToConsole("warn", message, metadata);
    this.logs.push({
      level: "warn",
      message,
      timestamp: new Date(),
      metadata,
    });
  }

  error(
    message: string,
    error?: Error,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.shouldLog("error")) {
      return;
    }
    this.logToConsole("error", message, metadata);
    this.logs.push({
      level: "error",
      message,
      timestamp: new Date(),
      metadata,
      error,
    });
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("debug")) {
      return;
    }
    this.logToConsole("debug", message, metadata);
    this.logs.push({
      level: "debug",
      message,
      timestamp: new Date(),
      metadata,
    });
  }

  success(message: string, metadata?: Record<string, unknown>): void {
    this.logToConsole("success", message, metadata);
    this.logs.push({
      level: "success",
      message,
      timestamp: new Date(),
      metadata,
    });
  }

  startStep(stepName: string): void {
    this.currentStep = {
      name: stepName,
      startTime: Date.now(),
    };
    this.debug(`Starting step: ${stepName}`);
  }

  endStep(success: boolean, message?: string): void {
    if (!this.currentStep) {
      this.warn("endStep called without startStep");
      return;
    }

    const duration = Date.now() - this.currentStep.startTime;
    const logMessage = message || `${this.currentStep.name} completed`;

    if (success) {
      this.success(`${logMessage} (${duration}ms)`, { duration });
    } else {
      this.error(`${logMessage}`, undefined, { duration });
    }

    this.currentStep = null;
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  formatLogsForFile(): string {
    const header = `Repository Sync Orchestrator - Log Report
Generated: ${new Date().toISOString()}
=====================================\n\n`;

    const entries = this.logs
      .map((log) => {
        let entry = `[${log.level.toUpperCase()}] ${log.timestamp.toISOString()} - ${log.message}`;
        if (log.metadata && Object.keys(log.metadata).length > 0) {
          entry += `\n  Metadata: ${JSON.stringify(log.metadata, null, 2)}`;
        }
        if (log.error) {
          entry += `\n  Error: ${log.error.message}\n  Stack: ${log.error.stack}`;
        }
        return entry;
      })
      .join("\n\n");

    return header + entries;
  }

  async saveToFile(filePath: string): Promise<void> {
    try {
      const content = this.formatLogsForFile();
      await Bun.write(filePath, content);
      this.info(`Logs saved to ${filePath}`);
    } catch (error) {
      console.error(`Failed to save logs to ${filePath}:`, error);
    }
  }
}

export const createLogger = (
  logLevel: "debug" | "info" | "warn" | "error" = "info"
): Logger => {
  return new Logger(logLevel);
};
