import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import { EmulatorConfigurator } from './types';
import { IniEditor } from '../editors/ini';
import { JsonEditor } from '../editors/json';
import type { EmulatorPatch } from '../translators/ITranslator';

export abstract class BaseConfigurator implements EmulatorConfigurator {
  abstract configure(): Promise<void>;

  protected getHomeDir(): string {
    return homedir();
  }

  /** patches a specific key in an INI file */
  protected setIniValue(filePath: string, section: string, key: string, value: string) {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    let inSection = false;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyRegex = new RegExp(`^\\s*${escapedKey}\\s*=`);

    const newLines = lines.map(line => {
      const trimmed = line.trim();

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inSection = trimmed === `[${section}]`;
        return line;
      }

      if (inSection && keyRegex.test(line)) {
        return `${key} = ${value}`;
      }

      return line;
    });
    
    fs.writeFileSync(filePath, newLines.join('\n'));
  }

  protected applyPatches(patches: EmulatorPatch[]) {
    const iniPatchesByFile = new Map<string, EmulatorPatch[]>();
    const nonIniPatches: EmulatorPatch[] = [];

    for (const p of patches) {
      if (p.kind === 'ini-set') {
        if (!p.absPath) continue;
        const filePatches = iniPatchesByFile.get(p.absPath) ?? [];
        filePatches.push(p);
        iniPatchesByFile.set(p.absPath, filePatches);
      } else {
        nonIniPatches.push(p);
      }
    }

    for (const [absPath, filePatches] of iniPatchesByFile.entries()) {
      const updates = this.patchesToIniUpdates(filePatches);
      IniEditor.updateIni(absPath, updates);
    }

    for (const p of nonIniPatches) {
      if (p.kind === 'file-write') {
        if (!p.absPath) continue;
        fs.mkdirSync(path.dirname(p.absPath), { recursive: true });
        fs.writeFileSync(p.absPath, p.contents, 'utf-8');
      } else if (p.kind === 'ini-delete') {
        if (!p.absPath) continue;
        IniEditor.deleteKeys(p.absPath, { [p.section]: [p.key] });
      } else if (p.kind === 'json-merge' || p.kind === 'json-set') {
        if (!p.absPath) continue;
        const jsonPath = p.absPath;
        JsonEditor.update<Record<string, unknown>>(
          jsonPath,
          (settings) => {
            const root = settings && typeof settings === 'object' ? settings : {};
            const pathParts = p.path;
            let current = root as Record<string, unknown>;
            for (let i = 0; i < pathParts.length - 1; i++) {
              const part = pathParts[i];
              if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
              }
              current = current[part] as Record<string, unknown>;
            }
            const lastPart = pathParts[pathParts.length - 1];
            if (p.kind === 'json-merge') {
              const existing = current[lastPart];
              if (
                existing &&
                typeof existing === 'object' &&
                !Array.isArray(existing) &&
                p.value &&
                typeof p.value === 'object' &&
                !Array.isArray(p.value)
              ) {
                current[lastPart] = { ...existing, ...(p.value as object) };
              } else {
                current[lastPart] = p.value;
              }
            } else {
              current[lastPart] = p.value;
            }
            return root;
          },
          {}
        );
      }
    }
  }

  protected patchesToIniUpdates(patches: EmulatorPatch[]): Record<string, Record<string, string>> {
    const out: Record<string, Record<string, string>> = {};
    for (const p of patches) {
      if (p.kind !== 'ini-set') continue;
      const section = (p.section ?? '').trim();
      out[section] ??= {};
      out[section][p.key] = p.value;
    }
    return out;
  }

  protected findBiosFile(biosDir: string, validBiosNames: string[] = []): string | null {
    if (!fs.existsSync(biosDir)) return null;

    for (const name of validBiosNames) {
      const cand = path.join(biosDir, name);
      if (fs.existsSync(cand)) {
        try {
          if (fs.statSync(cand).isFile()) return name;
        } catch {
          // ignore error
        }
      }
    }

    try {
      const files = fs.readdirSync(biosDir);
      const biosFile = files.find(f => {
        const candidatePath = path.join(biosDir, f);
        try {
          if (!fs.statSync(candidatePath).isFile()) return false;
        } catch {
          return false;
        }
        const lower = f.toLowerCase();
        return lower.endsWith('.bin') && (lower.startsWith('scph') || lower.includes('bios'));
      });
      return biosFile || null;
    } catch {
      return null;
    }
  }
}