import { useState, type ReactNode } from "react"
import { Sparkles, type LucideIcon } from "lucide-react"

export function StepCard({
  title,
  subtitle,
  hint,
  icon: Icon,
  children,
}: {
  title: string
  subtitle?: string
  hint?: string
  icon?: LucideIcon
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 overflow-hidden rounded-[28px] border border-line bg-paper-2 shadow-[0_18px_40px_-32px_rgba(88,61,43,0.55)] duration-300">
      <div className="relative overflow-hidden bg-gradient-to-r from-brand to-[#d9815f] px-5 py-4 text-[#fff8f1] sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-10 size-28 rounded-full bg-[#ffe9d6]/25"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20 ring-1 ring-white/30">
                <Icon className="size-5" />
              </span>
            )}
            <div>
              <h2 className="text-lg font-bold leading-tight">{title}</h2>
              {subtitle && <p className="mt-1 text-sm text-[#ffeadc]">{subtitle}</p>}
            </div>
          </div>
          {hint && (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-[#fff8f1] ring-1 ring-white/25 transition hover:bg-white/25 sm:flex"
            >
              <Sparkles className="size-3.5" />
              这一步做什么
            </button>
          )}
        </div>
        {hint && open && (
          <p className="relative mt-3 rounded-2xl bg-white/15 px-3 py-2 text-sm leading-relaxed">
            {hint}
          </p>
        )}
      </div>
      <div className="border-t border-dashed border-brand/20 p-4 sm:p-6">{children}</div>
    </section>
  )
}
