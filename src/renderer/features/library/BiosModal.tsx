import type { Game } from "../../../shared/types";
import { getConsoleNameFromId } from "../../../shared/emulators/derived";
import { Button, Modal, ModalTitle } from "../../ui";

interface Props {
  game: Game;
  missing?: string | null;
  onClose: () => void;
}

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export default function BiosModal({ game, missing, onClose }: Props) {
  const list = (missing ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const missingSize = list.length;

  return (
    <Modal onClose={onClose} padding="lg" align="center">
      <ModalTitle>BIOS Required</ModalTitle>
      <p className="text-fg-muted mb-6 mt-2">
        To play <strong>{getConsoleNameFromId(game.consoleId)}</strong> games,{" "}
        {capitalize(game.engineId)} requires the BIOS file{missingSize > 1 ? "s" : ""}.
      </p>

      <div className="border-2 border-dashed border-border-highlight rounded-xl p-10 bg-bg-muted/50 mb-6 pointer-events-none select-none">
        <p className="text-fg-secondary font-semibold">Drag &amp; Drop</p>
        <code className="block mt-2 text-accent-secondary bg-black/30 px-2 py-1 rounded-sm">
          {missingSize > 0 ? list.join(" ") : "BIOS file"}
        </code>
        <p className="text-xs text-fg-muted mt-2">Anywhere on screen</p>
      </div>

      <Button intent="ghost" size="md" onClick={onClose}>
        Cancel
      </Button>
    </Modal>
  );
}
