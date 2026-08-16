export default function ListeningOverlay(props: { listeningFor: string; guided: boolean }) {
  const { listeningFor, guided } = props;

  return (
    <div className="fixed inset-0 bg-bg-primary/90 z-modal flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-base">
      <div className="bg-bg-secondary p-8 rounded-xl border border-border-highlight shadow-modal text-center max-w-sm w-full">
        <h2 className="text-xl font-bold mb-2 text-fg-primary">{guided ? "Guided Setup" : "Map Control"}</h2>
        <p className="text-fg-secondary mb-6">
          Press any button for <br />
          <span className="text-accent-secondary text-lg font-mono font-bold mt-2 block">{listeningFor}</span>
        </p>
        <p className="text-xs text-fg-muted uppercase tracking-widest font-bold">Press ESC to cancel</p>
      </div>
    </div>
  );
}
