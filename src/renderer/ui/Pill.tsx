import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export const pillVariants = cva(
  'inline-flex items-center border text-[10px] uppercase font-bold tracking-wider rounded-xs',
  {
    variants: {
      tone: {
        neutral: 'border-border-subtle text-fg-muted bg-bg-secondary',
        ok: 'border-border-highlight text-fg-primary bg-bg-muted',
        info: 'border-border-subtle text-fg-secondary bg-bg-secondary',
        warn: 'border-border-muted text-fg-primary bg-bg-secondary',
        bad: 'border-fg-primary text-fg-secondary bg-bg-secondary',
        danger: 'border-transparent bg-red-500/90 text-white',
      },
      size: { sm: 'px-2 py-0.5', md: 'px-2 py-1' },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  }
);

export type PillProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof pillVariants>;

export default function Pill({ tone, size, className, ...rest }: PillProps) {
  return <span className={cn(pillVariants({ tone, size }), className)} {...rest} />;
}
