interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

export function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-[var(--nm-text-muted)]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, className = '', ...props }: InputProps) {
  return (
    <input
      className={`nm-input w-full min-h-[44px] px-3 py-2 text-base text-[var(--nm-text)]
        placeholder:text-[var(--nm-text-subtle)]
        ${error ? 'outline outline-2 outline-red-400' : ''}
        disabled:opacity-50 ${className}`}
      {...props}
    />
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ error, className = '', children, ...props }: SelectProps) {
  return (
    <select
      className={`nm-input w-full min-h-[44px] px-3 py-2 text-base text-[var(--nm-text)]
        ${error ? 'outline outline-2 outline-red-400' : ''}
        disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ error, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      rows={3}
      className={`nm-input w-full px-3 py-2 text-base text-[var(--nm-text)] resize-none
        placeholder:text-[var(--nm-text-subtle)]
        ${error ? 'outline outline-2 outline-red-400' : ''}
        ${className}`}
      {...props}
    />
  )
}
