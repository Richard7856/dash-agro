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
    'inline-flex items-center justify-center font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'

  const sizes = {
    sm: 'px-3.5 py-1.5 text-sm min-h-[36px] rounded-[var(--nm-radius-sm)]',
    md: 'px-5 py-2.5 text-[15px] min-h-[46px] rounded-[var(--nm-radius-sm)]',
  }

  const variants = {
    primary:   'nm-btn-primary text-white focus:ring-blue-500',
    secondary: 'nm-btn text-[var(--nm-text)] focus:ring-blue-300',
    danger:    'bg-red-600 text-white rounded-[var(--nm-radius-sm)] hover:bg-red-700 focus:ring-red-400 shadow-md active:scale-95 active:shadow-sm border border-red-700',
    ghost:     'text-[var(--nm-text-muted)] hover:bg-black/5 rounded-[var(--nm-radius-sm)] focus:ring-[var(--nm-text-subtle)]',
  }

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 shrink-0" />
      ) : null}
      {children}
    </button>
  )
}
