import { useState, useEffect } from 'react';
import { settingsClient } from '../../clients/settingsClient';
import type { SettingsShape, SettingKey } from '../../../shared/settings';
import PageLayout from '../layout/PageLayout';
import ToggleSwitch from '../inputs/ToggleSwitch';
import { useOutletContext } from 'react-router-dom';
import type { LayoutContextType } from '../layout';

export default function Settings() {
  const [loading, setLoading] = useState('');
  const [settings, setSettings] = useState<Partial<SettingsShape>>({});
  const { setGlobalLoading, setGlobalStatus } = useOutletContext<LayoutContextType>();

  useEffect(() => {
    settingsClient.getMany(["setup.autoInstallEngines", "launch.fullscreen"]).then(setSettings);
  }, []);

  const updateSetting = async <K extends SettingKey>(key: K, value: SettingsShape[K]) => {
    await settingsClient.set(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleAction = async (action: string, endpoint: string, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    setLoading(action);
    setGlobalLoading(true);
    setGlobalStatus(`${action}...`);
    try {
      await window.electron.invoke(endpoint);
      alert(`${action} successful.`);
    } catch (err) {
      alert(`Failed to ${action.toLowerCase()}.`);
    } finally {
      setLoading('');
      setGlobalLoading(false);
    }
  };

  return (
    <PageLayout title="Settings">
      <div className="p-8 space-y-6">
        <section className="bg-bg-secondary border border-bg-muted rounded-sm overflow-hidden">
          <div className="p-6 space-y-6">

            <div>
              <div className="flex justify-between items-center">
                <div>
                   <h3 className="font-bold text-fg-primary">Auto-Install Engines</h3>
                   <p className="text-sm text-fg-muted">Automatically install required emulators when installing games/bios</p>
                </div>
              
                <ToggleSwitch
                  id="autoInstallEngines"
                  checked={settings["setup.autoInstallEngines"] ?? true}
                  onChange={(checked) => updateSetting("setup.autoInstallEngines", checked)}
                />
              </div>
            </div>
            <div className="h-px bg-border-subtle" />

            <div>
              <div className="flex justify-between items-center">
                <div>
                   <h3 className="font-bold text-fg-primary">Launch in Fullscreen</h3>
                   <p className="text-sm text-fg-muted">Start emulators in fullscreen mode when launching games</p>
                </div>
              
                <ToggleSwitch
                  id="launchFullscreen"
                  checked={settings["launch.fullscreen"] ?? false}
                  onChange={(checked) => updateSetting("launch.fullscreen", checked)}
                />
              </div>
            </div>
            <div className="h-px bg-border-subtle" />

            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-fg-primary">Clear Library</h3>
                <p className="text-sm text-fg-muted">Deletes all games</p>
              </div>
              <button
                onClick={() => handleAction('Clear Library', 'game:deleteAll', 'Delete ALL games? Cannot be undone.')}
                disabled={!!loading}
                className="px-4 py-2 bg-bg-muted text-fg-primary hover:bg-red-500/10 hover:text-red-400 border border-border-muted hover:border-red-500/30 rounded-none text-sm font-bold transition-all"
              >
                {loading === 'Clear Library' ? 'Processing...' : 'Delete Games'}
              </button>
            </div>

            <div className="h-px bg-border-subtle" />

            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-fg-primary">Uninstall Engines</h3>
                <p className="text-sm text-fg-muted">Deletes all downloaded emulators <span className='text-fg-secondary font-bold'>along with game save data.</span></p>
              </div>
              <button
                onClick={() => handleAction('Clear Engines', 'engine:clear', 'Uninstall all emulators?')}
                disabled={!!loading}
                className="px-4 py-2 bg-bg-muted text-fg-primary hover:bg-red-500/10 hover:text-red-400 border border-border-muted hover:border-red-500/30 rounded-none text-sm font-bold transition-all"
              >
                {loading === 'Clear Engines' ? 'Processing...' : 'Delete Engines'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}