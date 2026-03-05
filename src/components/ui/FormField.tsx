interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

export function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
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
      className={`w-full min-h-[44px] px-3 py-2 rounded-lg border text-base bg-white
        ${error ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-green-300'}
        focus:outline-none focus:ring-2 focus:border-transparent
        disabled:bg-gray-100 disabled:text-gray-500 ${className}`}
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
      className={`w-full min-h-[44px] px-3 py-2 rounded-lg border text-base bg-white
        ${error ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-green-300'}
        focus:outline-none focus:ring-2 focus:border-transparent
        disabled:bg-gray-100 ${className}`}
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
      className={`w-full px-3 py-2 rounded-lg border text-base bg-white resize-none
        ${error ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-green-300'}
        focus:outline-none focus:ring-2 focus:border-transparent ${className}`}
      {...props}
    />
  )
}
