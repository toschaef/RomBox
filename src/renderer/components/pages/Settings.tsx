import { useState, useEffect } from 'react';
import { settingsClient } from '../../clients/settingsClient';
import type { SettingsShape, SettingKey } from '../../../shared/settings';

export default function Settings() {
  const [loading, setLoading] = useState('');
  const [settings, setSettings] = useState<Partial<SettingsShape>>({});

  useEffect(() => {
    settingsClient.getMany(["setup.autoInstallEngines"]).then(setSettings);
  }, []);

  const updateSetting = async <K extends SettingKey>(key: K, value: SettingsShape[K]) => {
    await settingsClient.set(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleAction = async (action: string, endpoint: string, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    setLoading(action);
    try {
      await window.electron.invoke(endpoint);
      alert(`${action} successful.`);
    } catch (err) {
      alert(`Failed to ${action.toLowerCase()}.`);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="h-full p-8 overflow-y-auto">
      <header className="mb-8 py-4">
        <h1 className="text-3xl font-bold text-fg-primary">Settings</h1>
      </header>

        <section className="bg-bg-secondary border border-bg-muted rounded-xl overflow-hidden">
          <div className="p-6 space-y-6">

            <div>
              <div className="flex justify-between items-center">
                <div>
                   <h3 className="font-bold text-fg-primary">Auto-Install Engines</h3>
                   <p className="text-sm text-fg-muted">Automatically install required emulators when installing games/bios</p>
                </div>
              
                <input
                  id="autoInstallEngines"
                  type="checkbox"
                  checked={settings["setup.autoInstallEngines"] ?? true}
                  onChange={(e) => updateSetting("setup.autoInstallEngines", e.target.checked)}
                  className="w-5 h-5 accent-accent-primary"
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
                className="px-4 py-2 bg-bg-muted text-fg-primary hover:bg-red-500/10 hover:text-red-400 border border-border-muted rounded-md text-sm font-bold transition-all"
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
                className="px-4 py-2 bg-bg-muted text-fg-primary hover:bg-red-500/10 hover:text-red-400 border border-border-muted rounded-md text-sm font-bold transition-all"
              >
                {loading === 'Clear Engines' ? 'Processing...' : 'Delete Engines'}
              </button>
            </div>
          </div>
        </section>
      </div>
  );
}