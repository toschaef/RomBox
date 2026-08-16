import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from './cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none',
  {
    variants: {
      intent: {
        primary: 'bg-accent-secondary text-white border border-accent-secondary hover:bg-accent-primary',
        secondary: 'bg-bg-secondary text-fg-primary border border-border-subtle hover:border-border-muted hover:bg-bg-muted',
        ghost: 'bg-transparent text-fg-muted border border-transparent hover:text-fg-primary',
        danger: 'bg-bg-muted text-fg-primary border border-border-muted hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30',
      },
      size: {
        xs: 'px-2 py-1 text-[10px] rounded-xs',
        sm: 'px-3 py-1.5 text-xs rounded-sm',
        md: 'px-4 py-2 text-sm rounded-sm',
      },
      uppercase: { true: 'uppercase tracking-wider', false: '' },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { intent: 'secondary', size: 'sm', uppercase: false, full: false },
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { ref?: Ref<HTMLButtonElement> };

export default function Button({ intent, size, uppercase, full, className, type = 'button', ref, ...rest }: ButtonProps) {
  return (
    <button ref={ref} type={type} className={cn(buttonVariants({ intent, size, uppercase, full }), className)} {...rest} />
  );
}
