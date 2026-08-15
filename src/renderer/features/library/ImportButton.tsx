import { Button } from '../../ui';
import { libraryClient } from '../../clients/libraryClient';

interface ImportButtonProps {
  onImport: (filePaths: string[]) => void;
}

export default function ImportButton({ onImport }: ImportButtonProps) {
  const handleClick = async () => {
    try {
      const filePaths = await libraryClient.selectFilesOrDirectories();
      if (filePaths && filePaths.length > 0) {
        onImport(filePaths);
      }
    } catch (err) {
      console.error('Failed to open select dialog:', err);
    }
  };

  return (
    <Button
      intent="primary"
      uppercase
      onClick={handleClick}
      data-testid="import-button"
      id="manual-import-button"
      className="h-fit self-center shrink-0"
    >
      + Import
    </Button>
  );
}
