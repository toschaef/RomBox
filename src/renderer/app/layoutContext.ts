import { useOutletContext } from 'react-router-dom';

export interface LayoutContextType {
  lastBiosUpdate: string | null;
  refreshLibraryTrigger: number;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalStatus: (message: string) => void;
  importFiles: (files: FileList) => Promise<void>;
  importFilePaths: (filePaths: string[]) => Promise<void>;
}

export const useLayoutContext = () => useOutletContext<LayoutContextType>();
