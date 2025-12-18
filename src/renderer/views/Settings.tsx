import { useState } from 'react';

export default function Settings() {
  const [loading, setLoading] = useState('');

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
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-fg-primary">Settings</h1>
        <p className="text-fg-muted text-sm mt-1">Manage your application data</p>
      </header>


        <section className="bg-bg-secondary border border-red-500/20 rounded-xl overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-fg-primary">Clear Library</h3>
                <p className="text-sm text-fg-muted">Deletes all games</p>
              </div>
              <button
                onClick={() => handleAction('Clear Library', 'clear-library', 'Delete ALL games? Cannot be undone.')}
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
                onClick={() => handleAction('Clear Engines', 'clear-engines', 'Uninstall all emulators?')}
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