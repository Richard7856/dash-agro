interface FormHeaderProps {
  title: string
  onBack: () => void
}

export function FormHeader({ title, onBack }: FormHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button
        type="button"
        onClick={onBack}
        className="p-1 text-[var(--nm-text-muted)] hover:text-gray-800"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="text-xl font-bold text-[var(--nm-text)]">{title}</h1>
    </div>
  )
}
