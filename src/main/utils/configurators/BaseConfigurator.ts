import fs from 'fs';
import { homedir } from 'os';
import { EmulatorConfigurator } from './types';

export abstract class BaseConfigurator implements EmulatorConfigurator {
  abstract configure(): Promise<void>;

  protected getHomeDir(): string {
    return homedir();
  }

  /** patches a specific key in an INI file */
  protected setIniValue(filePath: string, section: string, key: string, value: string) {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let inSection = false;

    const newLines = lines.map(line => {
      const trimmed = line.trim();

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inSection = trimmed === `[${section}]`;
        return line;
      }

      if (inSection && trimmed.startsWith(key + ' =') || trimmed.startsWith(key + '=')) {
        return `${key} = ${value}`;
      }

      return line;
    });
    
    fs.writeFileSync(filePath, newLines.join('\n'));
  }
}