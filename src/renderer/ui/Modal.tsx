import { cva, type VariantProps } from 'class-variance-authority';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

export const modalVariants = cva(
  'w-full bg-bg-secondary border border-border-muted rounded-xl shadow-modal animate-in zoom-in-95 duration-base',
  {
    variants: {
      size: { sm: 'max-w-sm', md: 'max-w-md' },
      padding: { md: 'p-6', lg: 'p-8' },
      align: { left: 'text-left', center: 'text-center' },
    },
    defaultVariants: { size: 'md', padding: 'md', align: 'left' },
  }
);

export type ModalProps = VariantProps<typeof modalVariants> & {
  children: ReactNode;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  className?: string;
  'data-testid'?: string;
};

export default function Modal({
  size,
  padding,
  align,
  children,
  onClose,
  closeOnBackdrop = true,
  className,
  'data-testid': testId,
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      data-testid={testId}
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-base"
      onClick={(e) => {
        e.stopPropagation();
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cn(modalVariants({ size, padding, align }), className)} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-bold text-fg-primary">{children}</h2>;
}

export function ModalDescription({ children }: { children: ReactNode }) {
  return <p className="text-sm text-fg-muted mt-1">{children}</p>;
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-3 mt-4">{children}</div>;
}
