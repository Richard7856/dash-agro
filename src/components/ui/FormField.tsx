interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

export function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-[var(--nm-text)]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, className = '', ...props }: InputProps) {
  return (
    <input
      className={`nm-input w-full min-h-[44px] px-3.5 py-2.5 text-[15px] text-[var(--nm-text)]
        placeholder:text-[var(--nm-text-subtle)]
        ${error ? 'border-red-400 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.14)]' : ''}
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
      className={`nm-input w-full min-h-[44px] px-3.5 py-2.5 text-[15px] text-[var(--nm-text)]
        cursor-pointer
        ${error ? 'border-red-400 focus:border-red-500' : ''}
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
      className={`nm-input w-full px-3.5 py-2.5 text-[15px] text-[var(--nm-text)] resize-none
        placeholder:text-[var(--nm-text-subtle)]
        ${error ? 'border-red-400 focus:border-red-500' : ''}
        ${className}`}
      {...props}
    />
  )
}
