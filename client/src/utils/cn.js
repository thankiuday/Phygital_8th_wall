/**
 * cn — tiny class name utility.
 * Joins class strings, filtering out falsy values.
 *
 * Usage: cn('base-class', isActive && 'active', condition ? 'a' : 'b')
 */
export const cn = (...classes) => classes.filter(Boolean).join(' ');
