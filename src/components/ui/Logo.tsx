import Image from 'next/image';
import { cn } from '@/lib/domain/helpers';

/**
 * The team mark.
 *
 * A photograph rather than a flat glyph, so it is cropped to a circle and
 * covered rather than stretched — the source is square today, but a
 * non-square replacement must not distort.
 */
export function Logo({
  size = 32,
  priority = false,
  className,
}: {
  size?: number;
  /** Set on the login screen, where the mark is the largest thing above the fold. */
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src="/logo.jpg"
      alt="Team Najeeb"
      width={size}
      height={size}
      priority={priority}
      className={cn('rounded-full object-cover shrink-0', className)}
      style={{ width: size, height: size }}
    />
  );
}
