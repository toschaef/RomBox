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