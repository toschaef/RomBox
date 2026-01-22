import { useState } from "react";
import ProfileModals from "./ProfileModals";

type ProfileMeta = { id: string; name: string; is_default: number };

export default function ControlsHeader(props: {
  profiles: ProfileMeta[];
  activeProfileId: string | null;

  onChangeProfile: (id: string) => void;
  onCreateProfile: (name: string) => void;
  onRenameProfile: (id: string, name: string) => void;
  onDeleteProfile: (id: string) => void;
  onSetDefault: (id: string) => void;

  onReset: () => void;
  onClear: () => void;

  saving?: boolean;
}) {
  const {
    profiles,
    activeProfileId,
    onChangeProfile,
    onCreateProfile,
    onRenameProfile,
    onDeleteProfile,
    onSetDefault,
    onReset,
    onClear,
    saving,
  } = props;

  const [modalType, setModalType] = useState<"create" | "rename" | "delete" | null>(null);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  const handleModalSubmit = (val: string) => {
    if (modalType === "create") onCreateProfile(val);
    else if (modalType === "rename" && activeProfileId) onRenameProfile(activeProfileId, val);
    else if (modalType === "delete" && activeProfileId) onDeleteProfile(activeProfileId);
  };

  return (
    <>
      <ProfileModals
        type={modalType}
        initialValue={modalType === "create" ? "" : activeProfile?.name}
        onClose={() => setModalType(null)}
        onSubmit={handleModalSubmit}
      />

      <div className="flex items-center gap-4">
        {saving && <div className="text-xs text-fg-muted uppercase tracking-wider animate-pulse">Saving...</div>}

        <div className="flex items-center gap-2">
            <div className="relative group">
              <select
                value={activeProfileId ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  onChangeProfile(id);
                  onSetDefault(id);
                }}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm font-medium bg-bg-secondary text-fg-primary border border-border-subtle hover:border-border-muted transition-colors min-w-32 rounded-none focus:outline-none focus:border-accent-primary"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id} className="bg-bg-secondary text-fg-primary">
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-fg-secondary">
                ▼
              </div>
            </div>

            <div className="flex border border-border-subtle bg-bg-secondary">
              <button
                onClick={() => setModalType("create")}
                title="New Profile"
                className="p-1.5 hover:bg-bg-muted text-fg-secondary hover:text-accent-secondary transition-colors border-r border-border-subtle"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
              </button>

              <button
                onClick={() => setModalType("rename")}
                title="Rename Current"
                disabled={!activeProfile}
                className="p-1.5 hover:bg-bg-muted text-fg-secondary hover:text-accent-secondary transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-secondary border-r border-border-subtle"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  ></path>
                </svg>
              </button>

              <button
                onClick={() => setModalType("delete")}
                title="Delete Profile"
                disabled={!activeProfile || profiles.length <= 1}
                className="p-1.5 hover:bg-bg-muted text-fg-secondary hover:text-red-400 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-secondary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
              </button>
            </div>
        </div>

        <div className="h-6 w-px bg-border-subtle mx-2"></div>

        <div className="flex gap-2">
            <button
              onClick={onClear}
              className="px-3 py-1.5 text-xs font-bold transition-colors border bg-bg-secondary text-fg-primary border-border-subtle hover:border-border-highlight hover:bg-bg-muted rounded-none"
            >
              Clear
            </button>

            <button
              onClick={onReset}
              className="px-3 py-1.5 text-xs font-bold transition-colors border bg-bg-secondary text-fg-primary border-border-subtle hover:border-border-highlight hover:bg-bg-muted rounded-none"
            >
              Reset
            </button>
        </div>
      </div>
    </>
  );
}