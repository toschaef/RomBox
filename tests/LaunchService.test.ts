import { LaunchService } from '../src/main/services/LaunchService';
import { EngineService } from '../src/main/services/EngineService';
import { osHandler } from '../src/main/platform';

jest.mock('../src/main/services/EngineService');
jest.mock('../src/main/platform');
jest.mock('electron', () => ({ app: { getPath: () => '/mock' } }));

describe('LaunchService', () => {
  const mockGame = { 
    id: '1', 
    title: 'Pokemon', 
    filePath: '/roms/poke.gba', 
    consoleId: 'gba' as const 
  };

  test('should fail if Engine is not installed', async () => {
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue(null);

    const result = await LaunchService.launch(mockGame);

    expect(result.success).toBe(false);
    expect(result.code).toBe('MISSING_ENGINE');
  });

  test('should fail if BIOS is required but missing', async () => {
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue('/bin/gba');

    (EngineService.isBiosInstalled as jest.Mock).mockReturnValue(false);

    const result = await LaunchService.launch(mockGame);

    expect(result.success).toBe(false);
    expect(result.code).toBe('MISSING_BIOS');
  });

  test('should spawn process if all checks pass', async () => {
    (EngineService.getEnginePath as jest.Mock).mockResolvedValue('/bin/gba');
    (EngineService.isBiosInstalled as jest.Mock).mockReturnValue(true);

    const mockChild = { 
      stdout: { on: jest.fn() }, 
      stderr: { on: jest.fn() }, 
      on: jest.fn(), 
      unref: jest.fn() 
    };
    (osHandler.launchProcess as jest.Mock).mockReturnValue(mockChild);

    const result = await LaunchService.launch(mockGame);

    expect(result.success).toBe(true);
    expect(osHandler.launchProcess).toHaveBeenCalledWith(
      expect.stringContaining('/bin/gba'),
      expect.arrayContaining(['/roms/poke.gba'])
    );
  });
});