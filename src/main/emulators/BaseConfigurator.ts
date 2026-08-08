import fs from 'fs';
import path from 'path';
import { EmulatorConfigurator } from './configuratorTypes';
import { IniEditor } from '../utils/editors/ini';
import { JsonEditor } from '../utils/editors/json';
import type { EmulatorPatch } from './translatorTypes';
import { ControlsService, controlsService } from '../services/ControlsService';
import type { ConsoleID } from '../../shared/types';
import type { ConsoleLayout, ControlsProfile } from '../../shared/types/controls';

export abstract class BaseConfigurator implements EmulatorConfigurator {
  abstract configure(): Promise<void>;

  // loads the bindings that should be written for a console
  protected async resolveControls(consoleId: ConsoleID): Promise<{
    controls: ControlsService;
    profile: ControlsProfile;
    layout: ConsoleLayout;
    effectiveProfile: ControlsProfile;
  }> {
    const profile = controlsService.getDefaultProfile();
    const layout = await controlsService.getEffectiveConsoleLayout(consoleId, profile.id);

    return {
      controls: controlsService,
      profile,
      layout,
      effectiveProfile: {
        ...profile,
        player1: layout.player1,
        player2: layout.player2,
        player3: layout.player3,
        player4: layout.player4,
      },
    };
  }

  protected applyPatches(patches: EmulatorPatch[]) {
    const iniPatchesByFile = new Map<string, EmulatorPatch[]>();
    const nonIniPatches: EmulatorPatch[] = [];

    for (const p of patches) {
      if (p.kind === 'ini-set' || p.kind === 'ini-set-list') {
        if (!p.absPath) continue;
        const filePatches = iniPatchesByFile.get(p.absPath) ?? [];
        filePatches.push(p);
        iniPatchesByFile.set(p.absPath, filePatches);
      } else {
        nonIniPatches.push(p);
      }
    }

    for (const [absPath, filePatches] of iniPatchesByFile.entries()) {
      const updates = this.patchesToIniUpdatesWithLists(filePatches);
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

  /**
   * Single-valued view of the patches, for formats without a multi-key concept
   * (TOML/BML). Ignores 'ini-set-list'.
   */
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

  /** As above, but keeps 'ini-set-list' values as lists of repeated keys. */
  private patchesToIniUpdatesWithLists(
    patches: EmulatorPatch[]
  ): Record<string, Record<string, string | string[]>> {
    const out: Record<string, Record<string, string | string[]>> = {};
    for (const p of patches) {
      if (p.kind !== 'ini-set' && p.kind !== 'ini-set-list') continue;
      const section = (p.section ?? '').trim();
      out[section] ??= {};
      out[section][p.key] = p.kind === 'ini-set-list' ? p.values : p.value;
    }
    return out;
  }

}
