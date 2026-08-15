import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export const segmentGroupVariants = cva('flex', {
  variants: {
    bordered: { true: 'border border-border-subtle bg-bg-secondary', false: 'bg-bg-secondary rounded-sm p-1 border border-border-subtle' },
  },
  defaultVariants: { bordered: true },
});

export const segmentVariants = cva('font-bold transition-colors cursor-pointer select-none focus:outline-none', {
  variants: {
    selected: {
      true: 'bg-accent-secondary text-white',
      false: 'text-fg-secondary hover:text-accent-secondary hover:bg-bg-muted',
    },
    size: {
      sm: 'px-2 py-1 text-xs rounded-xs',
      md: 'px-3 py-1.5 text-xs',
    },
    divided: { true: 'border-r border-border-subtle', false: '' },
  },
  defaultVariants: { selected: false, size: 'md', divided: false },
});

export type SegmentOption<T extends string> = { value: T; label: string; title?: string };

export type SegmentedControlProps<T extends string> = VariantProps<typeof segmentGroupVariants> & {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: VariantProps<typeof segmentVariants>['size'];
  className?: string;
};

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  bordered,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn(segmentGroupVariants({ bordered }), className)} role="tablist">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={segmentVariants({
            selected: value === opt.value,
            size,
            divided: bordered !== false && i < options.length - 1,
          })}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export type SegmentButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof segmentVariants>;

export function Segment({ selected, size, divided, className, type = 'button', ...rest }: SegmentButtonProps) {
  return <button type={type} className={cn(segmentVariants({ selected, size, divided }), className)} {...rest} />;
}
