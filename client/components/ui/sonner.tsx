import { useEffect, useState } from "react"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"

import { cn } from "@/client/lib/utils"

type ToastType = "success" | "error" | "info"

type ToastAction = { label: string; onClick: () => void }

type ToastItem = {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
  leaving?: boolean
}

let pushToast: ((message: string, type: ToastType, action?: ToastAction) => void) | null = null

export function toast(message: string, type: ToastType = "info", action?: ToastAction) {
  pushToast?.(message, type, action)
}

toast.success = (m: string) => toast(m, "success")
toast.error = (m: string) => toast(m, "error")
toast.info = (m: string) => toast(m, "info")

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    pushToast = (message, type, action) => {
      const id = Date.now() + Math.random()
      setItems((prev) => [...prev, { id, message, type, action }])
      setTimeout(() => {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, leaving: true } : it)))
        setTimeout(() => {
          setItems((prev) => prev.filter((it) => it.id !== id))
        }, 300)
      }, 3500)
    }
    return () => {
      pushToast = null
    }
  }, [])

  function dismiss(id: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, leaving: true } : it)))
    setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.id !== id))
    }, 300)
  }

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
      {items.map((it) => (
        <div
          key={it.id}
          className={cn(
            "border-line bg-paper-2 text-ink pointer-events-auto flex w-full items-start gap-2.5 rounded-2xl border px-4 py-3",
            "shadow-[0_18px_40px_-24px_rgba(88,61,43,0.55)]",
            it.leaving
              ? "animate-out fade-out-0 slide-out-to-top-2 duration-300"
              : "animate-in slide-in-from-top-5 fade-in duration-200",
          )}
        >
          <ToastIcon type={it.type} />
          <div className="flex-1">
            <p className="text-sm font-semibold">{it.message}</p>
            {it.action && (
              <button
                onClick={() => {
                  it.action?.onClick()
                  dismiss(it.id)
                }}
                className="text-brand mt-1 text-sm font-semibold underline-offset-2 hover:underline"
              >
                {it.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => dismiss(it.id)}
            className="text-ink-soft hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "success") return <CheckCircle2 className="text-mint mt-0.5 size-5" />
  if (type === "error") return <AlertCircle className="text-brand-deep mt-0.5 size-5" />
  return <Info className="text-brand mt-0.5 size-5" />
}
