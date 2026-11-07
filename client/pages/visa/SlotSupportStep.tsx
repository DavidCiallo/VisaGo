import { RefreshCw } from "lucide-react"

import { cn } from "@/client/lib/utils"
import {
  VISA_SLOT_SUPPORT_OPTIONS,
  type VisaSlotSupport,
} from "@/shared/modules/visa/visa.catalog"
import { StepCard } from "./StepCard"

export function SlotSupportStep({
  value,
  onChange,
}: {
  value: VisaSlotSupport
  onChange: (value: VisaSlotSupport) => void
}) {
  return (
    <StepCard
      icon={RefreshCw}
      title="刷位意愿"
      subtitle="当您想预约的位置需要刷位抢订时，是否接受额外的支出。"
      hint="刷位是在放位时自动抢订，额外费用后续结算。"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {VISA_SLOT_SUPPORT_OPTIONS.map((option) => {
          const active = value === option.key
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.key)}
              className={cn(
                "rounded-[20px] border px-4 py-3 text-left transition",
                active
                  ? "border-brand bg-brand-soft/60 ring-4 ring-brand/10"
                  : "border-line bg-paper-2 hover:border-brand/40 hover:bg-paper-3/50",
              )}
            >
              <span
                className={cn(
                  "block text-sm font-bold",
                  active ? "text-brand-deep" : "text-ink",
                )}
              >
                {option.label}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
                {option.desc}
              </span>
            </button>
          )
        })}
      </div>
    </StepCard>
  )
}
