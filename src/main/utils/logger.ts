export class Logger {
  private prefix: string;
  private context: Record<string, unknown>;

  constructor(name: string, context: Record<string, unknown> = {}) {
    this.prefix = `[${name}]`;
    this.context = context;
  }

  private formatMessage(message: string): string {
    const contextStr = Object.keys(this.context).length > 0
      ? ` ${JSON.stringify(this.context)}`
      : '';
    return `${this.prefix} ${message} ${contextStr}`;
  }

  private formatWithData(message: string, data?: unknown): string {
    const base = this.formatMessage(message);
    return data !== undefined ? `${base} ${JSON.stringify(data)}` : base;
  }

  info(message: string, data?: unknown): void {
    console.log(this.formatWithData(message, data));
  }

  warn(message: string, data?: unknown): void {
    console.warn(this.formatWithData(message, data));
  }

  error(message: string, error?: unknown): void {
    const base = this.formatMessage(message);
    if (error instanceof Error) {
      console.error(`${base} ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    } else if (error !== undefined) {
      console.error(`${base} ${JSON.stringify(error)}`);
    } else {
      console.error(base);
    }
  }

  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatWithData(message, data));
    }
  }

  child(additionalContext: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.prefix.slice(1, -1), {
      ...this.context,
      ...additionalContext,
    });
    return childLogger;
  }

  static create(name: string, context?: Record<string, unknown>): Logger {
    return new Logger(name, context);
  }
}

export const MainLogger = Logger.create('Main');
export const IPCLogger = Logger.create('IPC');
