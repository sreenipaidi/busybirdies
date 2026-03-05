/**
 * Simple class name utility for conditionally joining class strings.
 * For production, consider using clsx + tailwind-merge.
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
