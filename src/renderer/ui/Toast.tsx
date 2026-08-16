import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from './cn';

export const toastVariants = cva(
  'flex items-center gap-2.5 px-3.5 py-3 min-w-70 max-w-100 rounded-none border bg-bg-secondary text-fg-primary text-[13px] font-semibold leading-snug pointer-events-auto relative overflow-hidden',
  {
    variants: {
      tone: {
        success: 'border-green-900',
        error: 'border-red-900',
        loading: 'border-accent-primary',
      },
      motion: {
        enter: 'animate-in fade-in slide-in-from-right-20 duration-slow ease-out-expo',
        exit: 'animate-out fade-out slide-out-to-right-20 duration-fast ease-in-quad fill-mode-forwards',
      },
    },
    defaultVariants: { tone: 'success', motion: 'enter' },
  }
);

export const toastAccentVariants = cva('absolute left-0 top-0 bottom-0 w-0.75', {
  variants: {
    tone: { success: 'bg-green-500', error: 'bg-red-500', loading: 'bg-accent-primary' },
  },
  defaultVariants: { tone: 'success' },
});

export type ToastProps = VariantProps<typeof toastVariants> & {
  children: ReactNode;
  className?: string;
};

export default function Toast({ tone, motion, children, className }: ToastProps) {
  return (
    <div className={cn(toastVariants({ tone, motion }), className)}>
      <span className={toastAccentVariants({ tone })} />
      {children}
    </div>
  );
}

export function ToastSlot({ exiting, children }: { exiting?: boolean; children: ReactNode }) {
  return <div className={exiting ? 'overflow-hidden animate-toast-collapse' : undefined}>{children}</div>;
}
