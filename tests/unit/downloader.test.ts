import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import axios from 'axios';
import { Downloader } from '../../src/main/utils/downloader';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Downloader utility', () => {
  const testDir = path.resolve(__dirname, '../temp-downloader-tests');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (err) {
      // ignore
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should download a file successfully from a stream and invoke progress callbacks', async () => {
    const url = 'https://example.com/engines/dolphin-mac.zip';
    const mockData = 'mock zip binary content';
    
    // Create a mock readable stream
    const mockStream = Readable.from([mockData]);
    mockedAxios.get.mockResolvedValueOnce({
      data: mockStream,
      status: 200
    });

    const progressMsgs: string[] = [];
    const onProgress = (msg: string) => progressMsgs.push(msg);

    const destPath = await Downloader.download(url, testDir, { onProgress });

    expect(destPath).toBe(path.join(testDir, 'dolphin-mac.zip'));
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.readFileSync(destPath, 'utf8')).toBe(mockData);
    expect(progressMsgs).toContain('Downloading dolphin-mac.zip...');
    expect(mockedAxios.get).toHaveBeenCalledWith(url, expect.any(Object));

    // Cleanup
    fs.unlinkSync(destPath);
  });

  it('should clean up partial files and throw descriptive error on 404', async () => {
    const url = 'https://example.com/engines/missing.zip';
    
    const errorResponse = {
      response: {
        status: 404
      },
      message: 'Request failed with status code 404'
    };
    
    mockedAxios.get.mockRejectedValueOnce(errorResponse);

    const destPath = path.join(testDir, 'missing.zip');
    // Ensure file doesn't exist beforehand
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);

    await expect(Downloader.download(url, testDir))
      .rejects.toThrow('Download failed: Engine file could not be found');

    expect(fs.existsSync(destPath)).toBe(false);
  });

  it('should clean up partial files and throw descriptive error on 403', async () => {
    const url = 'https://example.com/engines/forbidden.zip';
    mockedAxios.get.mockRejectedValueOnce({
      response: {
        status: 403
      }
    });

    await expect(Downloader.download(url, testDir))
      .rejects.toThrow('Download failed: Access to engine file denied');
  });

  it('should clean up partial files and throw descriptive error on other server errors', async () => {
    const url = 'https://example.com/engines/server-error.zip';
    mockedAxios.get.mockRejectedValueOnce({
      response: {
        status: 500
      }
    });

    await expect(Downloader.download(url, testDir))
      .rejects.toThrow('Download failed: Server returned an error (500)');
  });

  it('should handle network DNS lookup failures (ENOTFOUND)', async () => {
    const url = 'https://bad-dns-site.com/file.zip';
    mockedAxios.get.mockRejectedValueOnce({
      code: 'ENOTFOUND',
      message: 'getaddrinfo ENOTFOUND bad-dns-site.com'
    });

    await expect(Downloader.download(url, testDir))
      .rejects.toThrow('Download failed: Network Error');
  });

  it('should handle timeouts and connection aborts', async () => {
    const url = 'https://timeout-site.com/file.zip';
    mockedAxios.get.mockRejectedValueOnce({
      code: 'ETIMEDOUT',
      message: 'timeout of 5000ms exceeded'
    });

    await expect(Downloader.download(url, testDir))
      .rejects.toThrow('Download failed: Connection timed out');
  });

  it('should validate status correctly', async () => {
    const url = 'https://example.com/engines/dolphin-mac.zip';
    const mockData = 'mock zip binary content';
    const mockStream = Readable.from([mockData]);
    mockedAxios.get.mockResolvedValueOnce({
      data: mockStream,
      status: 200
    });

    const destPath = await Downloader.download(url, testDir);
    fs.unlinkSync(destPath);

    const call = mockedAxios.get.mock.calls[0];
    expect(call).toBeDefined();
    const getOptions = call![1] as { validateStatus?: (status: number) => boolean } | undefined;
    expect(getOptions).toBeDefined();
    expect(getOptions!.validateStatus!(200)).toBe(true);
    expect(getOptions!.validateStatus!(299)).toBe(true);
    expect(getOptions!.validateStatus!(199)).toBe(false);
    expect(getOptions!.validateStatus!(300)).toBe(false);
  });

  it('should handle write stream error', async () => {
    const url = 'https://example.com/engines/dolphin-mac.zip';
    const mockStream = Readable.from(['content']);
    mockedAxios.get.mockResolvedValueOnce({
      data: mockStream,
      status: 200
    });

    const mockWriteStream = new (require('stream').Writable)({
      write(chunk: any, encoding: any, callback: any) {
        callback(null);
      }
    }) as any;
    mockWriteStream.close = jest.fn();

    const createWriteStreamSpy = jest.spyOn(fs, 'createWriteStream').mockReturnValueOnce(mockWriteStream);

    const downloadPromise = Downloader.download(url, testDir);
    
    process.nextTick(() => {
      mockWriteStream.emit('error', new Error('Write failure'));
    });

    await expect(downloadPromise).rejects.toThrow('Write failure');
    createWriteStreamSpy.mockRestore();
  });
});

