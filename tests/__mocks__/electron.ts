import path from 'path';
import { suiteTempDir, suiteUserDataDir } from '../helpers/tempDirs';

export const app = {
  getPath: jest.fn().mockImplementation((name: string) => {
    // resolved per call rather than captured at module load, so each suite gets
    // its own directory and suites can run in parallel.
    if (name === 'userData') return suiteUserDataDir();
    if (name === 'temp') return path.join(suiteTempDir(), 'temp');
    return `/mock/path/${name}`;
  }),
  getAppPath: jest.fn().mockReturnValue('/mock/app/path'),
  getName: jest.fn().mockReturnValue('rombox-mock'),
  getVersion: jest.fn().mockReturnValue('0.9.9-mock'),
};

const handlers: Record<string, (...args: unknown[]) => unknown> = {};

export const ipcMain = {
  on: jest.fn(),
  handle: jest.fn().mockImplementation((channel: string, cb: (...args: unknown[]) => unknown) => {
    handlers[channel] = cb;
  }),
  removeHandler: jest.fn().mockImplementation((channel: string) => {
    delete handlers[channel];
  }),
  // Helper methods for testing
  _invoke: async (channel: string, ...args: unknown[]) => {
    const cb = handlers[channel];
    if (!cb) {
      throw new Error(`No IPC handler registered for channel: ${channel}`);
    }
    return cb({ sender: { send: jest.fn() } } as unknown, ...args);
  },
  _clearHandlers: () => {
    for (const key in handlers) {
      delete handlers[key];
    }
  },
  _getHandlers: () => handlers,
};

export const ipcRenderer = {
  on: jest.fn(),
  invoke: jest.fn(),
  removeListener: jest.fn(),
  send: jest.fn(),
};

export const contextBridge = {
  exposeInMainWorld: jest.fn(),
};

export const webUtils = {
  getPathForFile: jest.fn().mockImplementation((file: unknown) => (file as { path?: string })?.path || ''),
};

export const shell = {
  openExternal: jest.fn().mockResolvedValue(true),
  openPath: jest.fn().mockResolvedValue(''),
};

export const dialog = {
  showOpenDialog: jest.fn(),
  showSaveDialog: jest.fn(),
  showMessageBox: jest.fn(),
};
