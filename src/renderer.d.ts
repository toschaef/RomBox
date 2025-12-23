export interface IElectronAPI {
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}