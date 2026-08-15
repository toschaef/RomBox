import type { Game, IpcResponse } from '../../../shared/types';
import { gameClient } from '../../clients/gameClient';
import { saveClient } from '../../clients/saveClient';
import { useNotifications } from '../../app/notifications/NotificationProvider';
import { NOTIFICATION_MESSAGES } from '../../../shared/constants';
import { getEmulatorNameFromEngineId } from '../../../shared/emulators/derived';

export type LaunchOutcome = 'launched' | 'needs-engine' | 'needs-bios' | 'missing-file' | 'failed';

export function useGameActions(game: Game, opts: { onRefresh: () => void }) {
  const { onRefresh } = opts;
  const { notify, durations } = useNotifications();

  const launch = async (): Promise<{ outcome: LaunchOutcome; biosMissing?: string | null }> => {
    if (game.fileMissing) return { outcome: 'missing-file' };

    try {
      const result: IpcResponse = await gameClient.launch(game);

      if (result.success) {
        console.log('Game launched without electron error');
        return { outcome: 'launched' };
      }

      if (result.code === 'ENGINE_INSTALLING') {
        notify(NOTIFICATION_MESSAGES.EMULATOR_INSTALLING(getEmulatorNameFromEngineId(game.engineId)), {
          type: 'error',
          duration: durations.medium,
        });
        return { outcome: 'failed' };
      }
      if (result.code === 'MISSING_ENGINE') return { outcome: 'needs-engine' };
      if (result.code === 'MISSING_BIOS') return { outcome: 'needs-bios', biosMissing: result.message ?? null };
      if (result.code === 'MISSING_FILE') return { outcome: 'missing-file' };

      console.error('Launch error:', result.message);
      notify(NOTIFICATION_MESSAGES.LAUNCH_FAILED(game.title), { type: 'error', duration: durations.medium });
      return { outcome: 'failed' };
    } catch (err) {
      console.error('IPC Error', err);
      notify(NOTIFICATION_MESSAGES.LAUNCH_FAILED(game.title), { type: 'error', duration: durations.medium });
      return { outcome: 'failed' };
    }
  };

  const remove = async () => {
    try {
      await gameClient.delete(game.id);
      notify(NOTIFICATION_MESSAGES.GAME_DELETED(game.title), { type: 'success', duration: durations.short });
      onRefresh();
    } catch (err) {
      console.error(err);
      notify(NOTIFICATION_MESSAGES.DELETE_FAILED(game.title), { type: 'error', duration: durations.medium });
    }
  };

  const exportSave = async () => {
    try {
      const result = await saveClient.export(game.id);

      if (result.success && result.exportedTo) {
        notify(NOTIFICATION_MESSAGES.SAVE_EXPORTED(game.title), { type: 'success', duration: durations.short });
      } else if (result.error !== 'Export cancelled') {
        notify(NOTIFICATION_MESSAGES.SAVE_EXPORT_FAILED(game.title), { type: 'error', duration: durations.medium });
      }
    } catch (err) {
      console.error('[GameCard] Export error:', err);
      notify(NOTIFICATION_MESSAGES.SAVE_EXPORT_FAILED(game.title), { type: 'error', duration: durations.medium });
    }
  };

  const importSave = async () => {
    try {
      const result = await saveClient.import(game.id);

      if (result.success) {
        const fileCount = result.importedFiles?.length ?? 0;
        notify(NOTIFICATION_MESSAGES.SAVE_IMPORTED(game.title, fileCount), {
          type: 'success',
          duration: durations.short,
        });
      } else if (result.message === 'Import cancelled') {
        return;
      } else if (result.issues?.length) {
        notify(NOTIFICATION_MESSAGES.SAVE_IMPORT_REJECTED(result.message ?? ''), {
          type: 'error',
          duration: durations.long,
        });
      } else {
        notify(NOTIFICATION_MESSAGES.SAVE_IMPORT_FAILED(game.title), { type: 'error', duration: durations.medium });
      }
    } catch (err) {
      console.error('[GameCard] Import error:', err);
      notify(NOTIFICATION_MESSAGES.SAVE_IMPORT_FAILED(game.title), { type: 'error', duration: durations.medium });
    }
  };

  return { launch, remove, exportSave, importSave };
}
