import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from './cn';

export const iconButtonVariants = cva(
  'inline-flex items-center justify-center leading-none transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none',
  {
    variants: {
      intent: {
        default: 'bg-bg-secondary border border-border-subtle text-fg-secondary hover:text-fg-primary hover:border-border-muted',
        ghost: 'bg-transparent border-none text-white/70 hover:text-white hover:bg-white/10',
        danger: 'bg-bg-secondary border border-border-subtle text-fg-secondary hover:text-red-400 hover:border-red-400/50',
      },
      size: {
        xs: 'h-4 w-4 p-0.5 text-[10px] rounded-xs',
        sm: 'h-5 w-5 p-1 text-xs rounded-sm',
        md: 'h-7 w-7 p-1.5 text-base font-bold rounded-sm',
        lg: 'h-8 w-8 text-lg rounded-sm',
      },
    },
    defaultVariants: { intent: 'default', size: 'md' },
  }
);

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants> & { ref?: Ref<HTMLButtonElement> };

export default function IconButton({ intent, size, className, type = 'button', ref, ...rest }: IconButtonProps) {
  return <button ref={ref} type={type} className={cn(iconButtonVariants({ intent, size }), className)} {...rest} />;
}
