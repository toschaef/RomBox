import { useState } from 'react';
import type { Game } from '../../../shared/types';
import { gameClient } from '../../clients/gameClient';
import { useNotifications } from '../../app/notifications/NotificationProvider';
import { NOTIFICATION_MESSAGES } from '../../../shared/constants';
import { Button, Modal, ModalActions, ModalTitle, TextInput } from '../../ui';

interface Props {
  game: Game;
  onClose: () => void;
  onSave: (updatedGame: Game) => void;
}

export default function UpdateGameModal({ game, onClose, onSave }: Props) {
  const [title, setTitle] = useState(game.title);
  const [isSaving, setIsSaving] = useState(false);
  const { notify, durations } = useNotifications();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updatedGame = { ...game, title };

    try {
      const result = await gameClient.update(updatedGame);
      if (result.success) {
        onSave(updatedGame);
        onClose();
      }
    } catch (err) {
      console.error("Failed to update", err);
      notify(NOTIFICATION_MESSAGES.RENAME_FAILED(game.title), { type: 'error', duration: durations.medium });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Edit Game Details</ModalTitle>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
        <div>
          <label htmlFor="game-title" className="block text-xs font-bold text-fg-muted uppercase tracking-wider mb-2">
            Game Title
          </label>
          <TextInput
            id="game-title"
            size="md"
            full
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-bg-muted"
          />
        </div>

        <ModalActions>
          <Button intent="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" intent="primary" size="md" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
