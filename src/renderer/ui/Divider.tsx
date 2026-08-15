import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

export const dividerVariants = cva('bg-border-subtle', {
  variants: {
    orientation: { horizontal: 'h-px w-full', vertical: 'w-px h-6' },
    inset: { none: '', sm: 'mx-1', md: 'mx-2' },
  },
  defaultVariants: { orientation: 'horizontal', inset: 'none' },
});

export type DividerProps = VariantProps<typeof dividerVariants> & { className?: string };

export default function Divider({ orientation, inset, className }: DividerProps) {
  return <div role="separator" className={cn(dividerVariants({ orientation, inset }), className)} />;
}
