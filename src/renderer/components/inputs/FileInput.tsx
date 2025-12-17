import { useRef } from 'react';
import * as React from 'react';

export type FileInputProps = {
  onChange(fileList: FileList | null): void; 
  accept?: string;
};

const FileInput = ({ onChange, accept }: FileInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        type="file"
        ref={inputRef}
        accept={accept}
        multiple
        style={{ display: 'none' }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          onChange(e.target.files); 
          e.target.value = '';
        }}
      />
      
      <button 
        onClick={handleClick}
        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-lg transition-colors"
      >
        Select ROMs
      </button>
    </div>
  );
};

export default FileInput;