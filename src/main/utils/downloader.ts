import fs from 'fs';
import path from 'path';
import axios from 'axios';

export const Downloader = {
  download: async (
    url: string, 
    destDir: string, 
    options: { onProgress?: (msg: string) => void; headers?: Record<string, string> } = {}
  ): Promise<string> => {

    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const urlFilename = path.basename(url.split('?')[0]);
    const destPath = path.join(destDir, urlFilename);

    if (options.onProgress) options.onProgress(`Downloading ${urlFilename}...`);

    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/octet-stream, application/zip, application/x-7z-compressed, */*',
          ...options.headers 
        },
        maxRedirects: 5,
        validateStatus: (status) => (status >= 200 && status <= 299)
      });

      const writer = fs.createWriteStream(destPath);
      
      return new Promise((resolve, reject) => {
        response.data.pipe(writer);
        let error: Error | null = null;
        
        writer.on('error', (err) => {
          error = err;
          writer.close();
          reject(err);
        });

        writer.on('close', () => {
          if (!error) resolve(destPath);
        });
      });

    } catch (err) {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);

      let errorMessage = err.message || 'An unknown error occurred';
      
      if (err.code === 'ENOTFOUND') {
        errorMessage = 'Network Error';
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
        errorMessage = 'Connection timed out';
      } else if (err.response?.status) {
        if (err.response.status === 404) {
          errorMessage = 'Engine file could not be found';
        } else if (err.response.status === 403) {
          errorMessage = 'Access to engine file denied';
        } else {
          errorMessage = `Server returned an error (${err.response.status})`;
        }
      }

      throw new Error(`Download failed: ${errorMessage}`);
    }
  }
};