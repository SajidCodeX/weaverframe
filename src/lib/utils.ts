import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function obscurePII(text: string | null | undefined, type: 'name' | 'email' | 'phone'): string {
  if (!text) return '';
  if (type === 'name') {
    // "John Doe" -> "J*** D***"
    return text.split(' ').map(w => w.length > 0 ? w.charAt(0) + '*'.repeat(w.length > 1 ? 3 : 0) : '').join(' ');
  }
  if (type === 'email') {
    // "john@example.com" -> "j***@***.com"
    const parts = text.split('@');
    if (parts.length !== 2) return '*'.repeat(5);
    return `${parts[0].charAt(0)}***@***.${parts[1].split('.')[1] || 'com'}`;
  }
  if (type === 'phone') {
    // "1234567890" -> "***-***-7890"
    return `***-***-${text.slice(-4)}`;
  }
  return '***';
}
