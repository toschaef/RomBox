import { useEffect, useRef, useState } from "react";
import { cn, Select, selectVariants } from "../../ui";

export type ProfileMeta = { id: string; name: string; isDefault: boolean };
export type ProfileEditMode = "create" | "rename" | null;

export function nextProfileName(profiles: readonly { name: string }[]) {
  const taken = new Set(profiles.map((p) => p.name.trim().toLowerCase()));
  let n = 1;
  while (taken.has(`profile ${n}`)) n++;
  return `Profile ${n}`;
}

function NameInput(props: {
  initial: string;
  label: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const { initial, label, onCommit, onCancel } = props;

  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  // mounts with the right value already, so the selection sticks
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    const name = value.trim();
    if (name) onCommit(name);
    else onCancel();
  };

  const cancel = () => {
    done.current = true;
    onCancel();
  };

  return (
    <input
      ref={ref}
      data-testid="profile-name-input"
      aria-label={label}
      placeholder="Profile Name"
      className={cn(selectVariants(), "w-full cursor-text border-accent-primary hover:border-accent-primary")}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
    />
  );
}

export default function ProfileSelect(props: {
  profiles: readonly ProfileMeta[];
  activeProfileId: string | null;
  mode: ProfileEditMode;
  onChangeProfile: (id: string) => void;
  onCommit: (name: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const { profiles, activeProfileId, mode, onChangeProfile, onCommit, onCancel, className } = props;

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // fixed box so swapping select <-> input never shifts the layout
  const box = cn("w-44", className);

  if (!mode) {
    return (
      <Select
        data-testid="profile-select"
        wrapperClassName={box}
        className="w-full truncate"
        value={activeProfileId ?? ""}
        options={profiles.map((p) => ({ value: p.id, label: p.name }))}
        blurOnChange
        onChange={(id) => {
          if (!id) return;
          onChangeProfile(id);
        }}
      />
    );
  }

  return (
    <div className={cn("relative inline-flex", box)}>
      <NameInput
        key={mode === "rename" ? `rename-${activeProfileId}` : "create"}
        initial={mode === "rename" ? (activeProfile?.name ?? "") : nextProfileName(profiles)}
        label={mode === "create" ? "New Profile Name" : "Profile Name"}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    </div>
  );
}
