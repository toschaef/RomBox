import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// cn is short for className
// i'm just using slang
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
