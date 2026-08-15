import { useEffect, useState } from "react";
import ProfileSelect, { type ProfileEditMode, type ProfileMeta } from "./ProfileSelect";
import { Button, ConfirmModal, Divider, IconButton } from "../../ui";

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

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
  onEditingChange?: (editing: boolean) => void;

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
    onEditingChange,
    saving,
  } = props;

  const [editMode, setEditMode] = useState<ProfileEditMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // naming a profile or confirming a delete must not bind whatever the user types
  useEffect(() => {
    onEditingChange?.(editMode !== null || confirmDelete);
  }, [editMode, confirmDelete, onEditingChange]);

  const handleCommit = (name: string) => {
    if (editMode === "create") onCreateProfile(name);
    else if (editMode === "rename" && activeProfileId && name !== activeProfile?.name) {
      onRenameProfile(activeProfileId, name);
    }
    setEditMode(null);
  };

  return (
    <>
      {confirmDelete && activeProfile && (
        <ConfirmModal
          title="Delete Profile?"
          description={
            <>
              Are you sure you want to delete <span className="text-fg-primary font-bold">{activeProfile.name}</span>?
              This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          destructive
          onConfirm={() => onDeleteProfile(activeProfile.id)}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      <div className="flex items-center gap-4">
        {saving && <div className="text-xs text-fg-muted uppercase tracking-wider animate-pulse">Saving...</div>}

        <div className="flex items-center gap-2">
          <ProfileSelect
            profiles={profiles}
            activeProfileId={activeProfileId}
            mode={editMode}
            onChangeProfile={(id) => {
              onChangeProfile(id);
              onSetDefault(id);
            }}
            onCommit={handleCommit}
            onCancel={() => setEditMode(null)}
          />

          <div className="flex border border-border-subtle bg-bg-secondary">
            <IconButton
              intent="ghost"
              size="md"
              title="New Profile"
              aria-label="New Profile"
              onClick={() => setEditMode("create")}
              className="p-1.5 text-fg-secondary hover:text-accent-secondary hover:bg-bg-muted border-r border-border-subtle rounded-none"
            >
              <PlusIcon />
            </IconButton>

            <IconButton
              intent="ghost"
              size="md"
              title="Rename Current"
              aria-label="Rename Current"
              disabled={!activeProfile}
              onClick={() => setEditMode("rename")}
              className="p-1.5 text-fg-secondary hover:text-accent-secondary hover:bg-bg-muted border-r border-border-subtle rounded-none"
            >
              <PencilIcon />
            </IconButton>

            <IconButton
              intent="ghost"
              size="md"
              title="Delete Profile"
              aria-label="Delete Profile"
              disabled={!activeProfile || profiles.length <= 1}
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-fg-secondary hover:text-red-400 hover:bg-bg-muted rounded-none"
            >
              <TrashIcon />
            </IconButton>
          </div>
        </div>

        <Divider orientation="vertical" inset="md" />

        <div className="flex gap-2">
          <Button onClick={onClear} className="hover:border-border-highlight">
            Clear
          </Button>
          <Button onClick={onReset} className="hover:border-border-highlight">
            Reset
          </Button>
        </div>
      </div>
    </>
  );
}
