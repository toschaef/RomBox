import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from './cn';

export const menuVariants = cva(
  'absolute z-dropdown rounded-sm border border-border-subtle bg-bg-secondary shadow-menu overflow-hidden animate-in fade-in zoom-in-95 duration-fast',
  {
    variants: {
      align: { left: 'left-0', right: 'right-0' },
      side: { top: 'bottom-full mb-1', bottom: 'top-10' },
      width: { sm: 'w-32', md: 'w-48', lg: 'w-64' },
    },
    defaultVariants: { align: 'right', side: 'bottom', width: 'md' },
  }
);

export type MenuProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof menuVariants> & { panelRef?: Ref<HTMLDivElement> };

export function Menu({ align, side, width, className, panelRef, ...rest }: MenuProps) {
  return (
    <div
      ref={panelRef}
      role="menu"
      className={cn(menuVariants({ align, side, width }), className)}
      onMouseDown={(e) => e.stopPropagation()}
      {...rest}
    />
  );
}

export const menuItemVariants = cva(
  'w-full text-left px-4 py-2 text-sm font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed',
  {
    variants: {
      intent: {
        default: 'text-fg-primary hover:bg-bg-muted',
        danger: 'text-red-400 hover:text-red-300 hover:bg-red-500/10',
      },
      size: { sm: 'px-3 py-2 text-xs font-semibold', md: '' },
    },
    defaultVariants: { intent: 'default', size: 'md' },
  }
);

export type MenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof menuItemVariants>;

export function MenuItem({ intent, size, className, type = 'button', ...rest }: MenuItemProps) {
  return <button type={type} role="menuitem" className={cn(menuItemVariants({ intent, size }), className)} {...rest} />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 py-2 text-xs text-fg-muted border-b border-border-subtle">{children}</div>;
}

export function MenuSeparator() {
  return <div className="h-px bg-border-subtle" />;
}
