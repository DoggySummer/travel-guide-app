import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'text'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'w-full min-h-12 rounded-card bg-ink text-canvas font-semibold disabled:opacity-40',
  secondary:
    'min-h-11 rounded-card border border-hairline bg-surface px-4 text-field font-semibold text-body disabled:opacity-40',
  text: 'min-h-11 px-2 text-content text-muted underline-offset-4 hover:underline disabled:opacity-40',
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${VARIANT_CLASS[variant]} ${className}`} {...props} />
}
