import { useState, DragEvent, useCallback, useEffect } from 'react';

type OnFilesDropped = (files: FileList) => void;

export const useDragAndDrop = (onFilesDropped: OnFilesDropped) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    console.log("[E2E DIAGNOSTIC] handleDrop called. dataTransfer exists:", !!e.dataTransfer);
    if (e.dataTransfer) {
      console.log("[E2E DIAGNOSTIC] dataTransfer.files exists:", !!e.dataTransfer.files);
      if (e.dataTransfer.files) {
        console.log("[E2E DIAGNOSTIC] dataTransfer.files.length:", e.dataTransfer.files.length);
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          console.log("[E2E DIAGNOSTIC] file at index", i, "is:", e.dataTransfer.files[i]);
        }
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesDropped(e.dataTransfer.files);
    }
  }, [onFilesDropped]);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('dragend', handleGlobalDragEnd, true);
    window.addEventListener('drop', handleGlobalDragEnd, true);
    window.addEventListener('mouseleave', handleGlobalDragEnd, true);

    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd, true);
      window.removeEventListener('drop', handleGlobalDragEnd, true);
      window.removeEventListener('mouseleave', handleGlobalDragEnd, true);
    };
  }, []);

  return {
    isDragging,
    dragProps: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    }
  };
};