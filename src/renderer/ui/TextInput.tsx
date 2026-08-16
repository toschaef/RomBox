import { cva, type VariantProps } from 'class-variance-authority';
import type { InputHTMLAttributes } from 'react';
import { cn } from './cn';

export const textInputVariants = cva(
  'bg-bg-secondary text-fg-primary border rounded-none placeholder:text-fg-muted transition-colors focus:outline-none',
  {
    variants: {
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
      },
      invalid: {
        true: 'border-red-500/50 focus:border-red-400',
        false: 'border-border-subtle hover:border-border-highlight focus:border-accent-primary',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { size: 'sm', invalid: false, full: false },
  }
);

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> &
  VariantProps<typeof textInputVariants>;

export default function TextInput({ size, invalid, full, className, type = 'text', ...rest }: TextInputProps) {
  return <input type={type} className={cn(textInputVariants({ size, invalid, full }), className)} {...rest} />;
}
