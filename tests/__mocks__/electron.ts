export const app = {
  getPath: jest.fn((name) => {
    if (name === 'userData') return '/mock/user/data';
    if (name === 'temp') return '/mock/temp';
    return '/mock/path';
  }),
};

export const ipcMain = {
  handle: jest.fn(),
};