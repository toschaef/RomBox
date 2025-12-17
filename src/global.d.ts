export {};

declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      getPathForFile: (file: File) => string;
    };
  }
}