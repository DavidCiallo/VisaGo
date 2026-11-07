import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Plane, ShieldCheck } from "lucide-react"

import { cn } from "@/client/lib/utils"

export function VisaHeader({ right, className }: { right?: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-brand to-[#d9815f] text-[#fff8f1] shadow-lg shadow-brand/25">
            <Plane className="size-4.5 -rotate-12" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-ink">VisaGo</span>
        </Link>
        {right ?? (
          <span className="flex items-center gap-1.5 rounded-full bg-paper-3 px-3 py-1.5 text-xs font-medium text-ink-soft">
            <ShieldCheck className="size-3.5 text-mint" />
            安全与隐私
          </span>
        )}
      </div>
    </header>
  )
}

export function VisaFooter() {
  return (
    <footer className="border-t border-line/70 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-5 text-center text-xs text-ink-soft/80">
        <p>© 2026 VisaGo</p>
      </div>
    </footer>
  )
}
