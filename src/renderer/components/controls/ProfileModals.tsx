import { useState, useEffect } from "react";

type ModalType = "create" | "rename" | "delete" | null;

interface ProfileModalsProps {
  type: ModalType;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (val: string) => void;
}

export default function ProfileModals({ type, initialValue = "", onClose, onSubmit }: ProfileModalsProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [type, initialValue]);

  if (!type) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(value);
    onClose();
  };

  const isDelete = type === "delete";

  return (
    <div className="fixed inset-0 bg-bg-primary/80 z-60 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-150">
      <form 
        onSubmit={handleSubmit}
        className="bg-bg-secondary p-6 rounded-2xl border border-border-muted shadow-2xl w-full max-w-sm"
      >
        <h3 className="text-xl font-bold text-fg-primary mb-4">
          {type === "create" && "New Profile"}
          {type === "rename" && "Rename Profile"}
          {type === "delete" && "Delete Profile?"}
        </h3>

        {isDelete ? (
          <p className="text-fg-secondary mb-6">
            Are you sure you want to delete <span className="text-fg-primary font-bold">{initialValue}</span>? 
            This cannot be undone.
          </p>
        ) : (
          <input
            autoFocus
            type="text"
            className="w-full bg-bg-muted border border-border-subtle rounded-lg px-4 py-2 text-fg-primary mb-6 focus:outline-none focus:border-accent-secondary placeholder:text-fg-muted"
            placeholder="Profile Name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-fg-muted hover:text-fg-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors border ${
              isDelete 
                ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20" 
                : "bg-accent-primary text-white border-transparent hover:bg-accent-secondary"
            }`}
          >
            {isDelete ? "Delete" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}