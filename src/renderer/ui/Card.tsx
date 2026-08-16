import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export const cardVariants = cva('relative rounded-sm border transition-all', {
  variants: {
    state: {
      default: 'border-border-subtle bg-bg-secondary',
      listening: 'border-accent-secondary bg-accent-muted/30',
      active: 'ring-1 ring-accent-secondary border-accent-secondary/50 bg-accent-muted/20 shadow-glow z-raised scale-[1.02]',
    },
    interactive: { true: 'cursor-pointer hover:bg-bg-muted hover:border-border-muted', false: '' },
    padding: { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' },
    speed: { instant: 'duration-instant ease-out', decay: 'duration-decay ease-out', base: 'duration-base' },
  },
  defaultVariants: { state: 'default', interactive: false, padding: 'none', speed: 'base' },
});

export type CardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export default function Card({ state, interactive, padding, speed, className, ...rest }: CardProps) {
  return <div className={cn(cardVariants({ state, interactive, padding, speed }), className)} {...rest} />;
}
