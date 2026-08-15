import { useState, useEffect, type ReactNode } from 'react';
import { settingsClient } from '../../clients/settingsClient';
import type { SettingsShape, SettingKey } from '../../../shared/settings';
import { RESOLUTION_OPTIONS } from '../../../shared/resolution';
import { Button, ConfirmModal, Divider, PageLayout, Select, Toggle } from '../../ui';
import { useLayoutContext } from '../../app/layoutContext';
import { usePersistedState, boolCodec } from '../../hooks/usePersistedState';
import { PREFERENCE_KEYS, PREFERENCE_DEFAULTS } from '../../preferences';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { libraryClient } from '../../clients/libraryClient';
import { engineClient } from '../../clients/engineClient';
import { NOTIFICATION_MESSAGES } from '../../../shared/constants';

function SettingRow({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-6">
      <div>
        <h3 className="font-bold text-fg-primary">{title}</h3>
        <p className="text-sm text-fg-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

type PendingAction = { key: string; title: string; description: string; confirmLabel: string; run: () => void } | null;

export default function Settings() {
  const [settings, setSettings] = useState<Partial<SettingsShape>>({});
  const { setGlobalLoading, setGlobalStatus } = useLayoutContext();
  const [pending, setPending] = useState<PendingAction>(null);

  const [alignGames, setAlignGames] = usePersistedState(
    PREFERENCE_KEYS.alignGames,
    PREFERENCE_DEFAULTS.alignGames,
    boolCodec
  );

  const { run, busyKey } = useAsyncAction({ setStatus: setGlobalStatus, setLoading: setGlobalLoading });

  useEffect(() => {
    settingsClient.getMany(["setup.autoInstallEngines", "launch.fullscreen", "launch.resolution"]).then(setSettings);
  }, []);

  const updateSetting = async <K extends SettingKey>(key: K, value: SettingsShape[K]) => {
    await settingsClient.set(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <PageLayout title="Settings">
      <div className="p-8 space-y-6">
        <section className="bg-bg-secondary border border-bg-muted rounded-sm overflow-hidden">
          <div className="p-6 space-y-6">
            <SettingRow
              title="Auto-Install Engines"
              description="Automatically install required emulators when installing games/bios"
            >
              <Toggle
                id="autoInstallEngines"
                checked={settings["setup.autoInstallEngines"] ?? true}
                onChange={(checked) => updateSetting("setup.autoInstallEngines", checked)}
              />
            </SettingRow>
            <Divider />

            <SettingRow
              title="Launch in Fullscreen"
              description="Start emulators in fullscreen mode when launching games"
            >
              <Toggle
                id="launchFullscreen"
                checked={settings["launch.fullscreen"] ?? false}
                onChange={(checked) => updateSetting("launch.fullscreen", checked)}
              />
            </SettingRow>
            <Divider />

            <SettingRow
              title="Align Games"
              description="Align library game cards vertically in rows or stack them organically"
            >
              <Toggle id="alignGames" checked={alignGames} onChange={setAlignGames} />
            </SettingRow>
            <Divider />

            <SettingRow
              title="Resolution"
              description="Internal rendering resolution for 3D emulators (PS1, PS2, GC/Wii, 3DS)"
            >
              <Select
                id="launchResolution"
                value={settings["launch.resolution"] ?? 0}
                options={RESOLUTION_OPTIONS}
                onChange={(v) => updateSetting("launch.resolution", Number(v))}
                className="min-w-35"
              />
            </SettingRow>
            <Divider />

            <SettingRow title="Clear Library" description="Deletes all games">
              <Button
                intent="danger"
                size="md"
                disabled={busyKey !== null}
                onClick={() =>
                  setPending({
                    key: 'Clear Library',
                    title: 'Delete all games?',
                    description: 'Every game is removed from the library. This cannot be undone.',
                    confirmLabel: 'Delete Games',
                    run: () =>
                      void run('Clear Library', () => libraryClient.deleteAllGames(), {
                        status: 'Clearing library...',
                        success: NOTIFICATION_MESSAGES.LIBRARY_CLEARED(),
                      }),
                  })
                }
              >
                {busyKey === 'Clear Library' ? 'Processing...' : 'Delete Games'}
              </Button>
            </SettingRow>

            <Divider />

            <SettingRow
              title="Uninstall Engines"
              description={
                <>
                  Deletes all downloaded emulators{' '}
                  <span className="text-fg-secondary font-bold">along with game save data.</span>
                </>
              }
            >
              <Button
                intent="danger"
                size="md"
                disabled={busyKey !== null}
                onClick={() =>
                  setPending({
                    key: 'Clear Engines',
                    title: 'Uninstall all emulators?',
                    description: 'All downloaded emulators and their save data are deleted.',
                    confirmLabel: 'Delete Engines',
                    run: () =>
                      void run('Clear Engines', () => engineClient.clear(), {
                        status: 'Uninstalling engines...',
                        success: NOTIFICATION_MESSAGES.ENGINES_CLEARED(),
                      }),
                  })
                }
              >
                {busyKey === 'Clear Engines' ? 'Processing...' : 'Delete Engines'}
              </Button>
            </SettingRow>
          </div>
        </section>
      </div>

      {pending && (
        <ConfirmModal
          destructive
          title={pending.title}
          description={pending.description}
          confirmLabel={pending.confirmLabel}
          onConfirm={pending.run}
          onClose={() => setPending(null)}
        />
      )}
    </PageLayout>
  );
}