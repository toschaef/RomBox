import path from 'path';

// Mock path for userData
const mockUserDataPath = path.resolve(__dirname, '../temp-userdata');

export const app = {
  getPath: jest.fn().mockImplementation((name: string) => {
    if (name === 'userData') {
      return mockUserDataPath;
    }
    return `/mock/path/${name}`;
  }),
  getAppPath: jest.fn().mockReturnValue('/mock/app/path'),
  getName: jest.fn().mockReturnValue('rombox-mock'),
  getVersion: jest.fn().mockReturnValue('0.9.9-mock'),
};

const handlers: Record<string, Function> = {};

export const ipcMain = {
  on: jest.fn(),
  handle: jest.fn().mockImplementation((channel: string, cb: Function) => {
    handlers[channel] = cb;
  }),
  removeHandler: jest.fn().mockImplementation((channel: string) => {
    delete handlers[channel];
  }),
  // Helper methods for testing
  _invoke: async (channel: string, ...args: any[]) => {
    const cb = handlers[channel];
    if (!cb) {
      throw new Error(`No IPC handler registered for channel: ${channel}`);
    }
    return cb({ sender: { send: jest.fn() } }, ...args);
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
  getPathForFile: jest.fn().mockImplementation((file: any) => file?.path || ''),
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
