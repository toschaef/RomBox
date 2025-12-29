// import { LibraryService } from '../src/main/services/LibraryService';
// import { getDB } from '../src/main/data/db';
// import { ScannerService } from '../src/main/services/ScannerService';
// import fs from 'fs';

// jest.mock('../src/main/data/db', () => ({ getDB: jest.fn() }));
// jest.mock('../src/main/services/ScannerService');
// jest.mock('fs', () => ({ existsSync: jest.fn(), unlinkSync: jest.fn() }));

// interface MockStatement {
//   run: jest.Mock;
//   get: jest.Mock;
//   all: jest.Mock;
// }

// interface MockDB {
//   prepare: jest.Mock<MockStatement>;
// }

// describe('LibraryService', () => {
//   let mockDb: MockDB;
//   let mockStmt: MockStatement;

//   beforeEach(() => {
//     jest.clearAllMocks();

//     mockStmt = { 
//       run: jest.fn(), 
//       get: jest.fn(), 
//       all: jest.fn() 
//     };

//     mockDb = { 
//       prepare: jest.fn().mockReturnValue(mockStmt) 
//     };

//     (getDB as jest.Mock).mockReturnValue(mockDb);
//   });

//   describe('createGameFromFile', () => {
//     test('should fail if scanner returns non-game type', async () => {
//       (ScannerService.scanFile as jest.Mock).mockResolvedValue({ type: 'unknown' });

//       const result = await LibraryService.createGamesFromFiles({ name: 'test', path: 'path' });
      
//       expect(result.success).toBe(false);
//       expect(result.message).toContain('Not a game ROM');
//     });

//     test('should succeed if scanner matches game', async () => {
//       (ScannerService.scanFile as jest.Mock).mockResolvedValue({ type: 'game', consoleId: 'nes' });

//       const mockGame = { id: '1', title: 'Test', filePath: 'path', consoleId: 'nes' };
//       (ScannerService.importGame as jest.Mock).mockResolvedValue(mockGame);

//       const result = await LibraryService.createGamesFromFiles({ name: 'test', path: 'path' });

//       expect(result.success).toBe(true);
//       expect(mockStmt.run).toHaveBeenCalledWith(mockGame);
//     });
//   });

//   describe('deleteGame', () => {
//     test('should return error if game not found in DB', () => {
//       mockStmt.get.mockReturnValue(undefined);

//       const result = LibraryService.deleteGame('bad-id');
      
//       expect(result.success).toBe(false);
//       expect(result.message).toBe('Game not found');
//     });

//     test('should run delete statement and remove file if exists', () => {
//       mockStmt.get.mockReturnValue({ filePath: '/roms/game.nes' });
//       (fs.existsSync as jest.Mock).mockReturnValue(true);

//       const result = LibraryService.deleteGame('good-id');

//       expect(result.success).toBe(true);
//       expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringMatching(/delete from games/i));
//       expect(fs.unlinkSync).toHaveBeenCalledWith('/roms/game.nes');
//     });
//   });
// });