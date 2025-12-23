export {};

declare global {
  interface Window {
    electron: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;

      getPathForFile: (file: File) => string;

      on: (channel: string, func: (...args: unknown[]) => void) => (() => void);
    };
  }
}