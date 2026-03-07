import React from 'react'

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  loading?: boolean
}

export function Btn({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: BtnProps) {
  const base =
    'inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-sm min-h-[36px]', md: 'px-4 py-2.5 text-base min-h-[44px]' }
  const variants = {
    primary:   'nm-btn-primary text-white focus:ring-green-500',
    secondary: 'nm-btn text-[var(--nm-text)] focus:ring-[var(--nm-text-subtle)]',
    danger:    'bg-red-600 text-white rounded-[var(--nm-radius-sm)] hover:bg-red-700 focus:ring-red-400 shadow-md active:scale-95',
    ghost:     'text-[var(--nm-text-muted)] hover:bg-[var(--nm-bg-inset)] rounded-[var(--nm-radius-sm)] focus:ring-[var(--nm-text-subtle)]',
  }

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : null}
      {children}
    </button>
  )
}
