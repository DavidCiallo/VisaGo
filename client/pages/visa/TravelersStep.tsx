import { Minus, Pencil, Plus } from "lucide-react"

import { cn } from "@/client/lib/utils"
import { MAX_TRAVELERS } from "@/shared/modules/visa/visa.catalog"
import { StepCard } from "./StepCard"

function TravelerBlob({ count, active }: { count: number; active: boolean }) {
  return (
    <svg
      viewBox="0 0 80 80"
      aria-hidden="true"
      className={cn("size-14 transition-opacity sm:size-20", active ? "opacity-100" : "opacity-60")}
    >
      <defs>
        <radialGradient
          id={`traveler-blob-${count}`}
          cx="32%"
          cy="22%"
          r="78%"
          gradientTransform={count === 2 ? "rotate(-26 0.5 0.5)" : undefined}
        >
          <stop offset="0%" stopColor="#fde3c6" />
          <stop offset="48%" stopColor="#eeb089" />
          <stop offset="100%" stopColor="#b5513a" />
        </radialGradient>
      </defs>
      {count === 1 && (
        <circle cx="40" cy="40" r="25" fill={`url(#traveler-blob-${count})`} opacity={0.88} />
      )}
      {count === 2 && (
        <g transform="rotate(-26 40 40)">
          <rect
            x="8"
            y="28"
            width="64"
            height="24"
            rx="12"
            fill={`url(#traveler-blob-${count})`}
            opacity={0.88}
          />
        </g>
      )}
      {count === 3 && (
        <g>
          <polygon points="40,12 14,56 40,72" fill="#efb08a" />
          <polygon points="40,12 40,72 66,56" fill="#b5513a" />
          <path
            d="M40 12 L14 56 M40 12 L66 56 M14 56 L40 72 L66 56"
            stroke="#fff3e2"
            strokeOpacity="0.35"
            strokeWidth="1.2"
            fill="none"
          />
        </g>
      )}
      {count === 4 && (
        <g>
          <polygon points="40,12 62,25 40,38 18,25" fill="#f8d3b2" />
          <polygon points="18,25 40,38 40,65 18,52" fill="#e09a72" />
          <polygon points="62,25 40,38 40,65 62,52" fill="#b5513a" />
          <path
            d="M40 38 L40 65 M18 25 L40 38 L62 25"
            stroke="#fff3e2"
            strokeOpacity="0.3"
            strokeWidth="1.2"
            fill="none"
          />
        </g>
      )}
    </svg>
  )
}

export function TravelersStep({
  travelers,
  onChange,
}: {
  travelers: number
  onChange: (travelers: number) => void
}) {
  return (
    <StepCard
      icon={Pencil}
      title="出行人数"
      subtitle="按实际办签人数选择，每人均享独立申请表与专属递签号。"
    >
      <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
        {Array.from({ length: MAX_TRAVELERS }, (_, index) => index + 1).map((count) => {
          const selected = travelers === count

          return (
            <button
              key={count}
              type="button"
              onClick={() => onChange(count)}
              aria-pressed={selected}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-[20px] border transition",
                selected
                  ? "border-brand bg-brand-soft/70 ring-4 ring-brand/10"
                  : "border-line bg-paper-2 hover:border-brand/40 hover:bg-paper-3/50",
              )}
            >
              <TravelerBlob count={count} active={selected} />
              <span className="flex items-baseline gap-0.5">
                <span
                  className={cn(
                    "text-2xl font-bold leading-none sm:text-3xl",
                    selected ? "text-brand-deep" : "text-ink",
                  )}
                >
                  {count}
                </span>
                <span className="text-xs text-ink-soft">人</span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-xs font-medium text-brand-deep">
        服务费全免，签证费按官方标准代收。
      </p>
      <p className="mt-3 text-xs text-ink-soft/80">4 人以上请联系人工客服。</p>
    </StepCard>
  )
}

export function TravelerStepper({
  travelers,
  onChange,
  className,
}: {
  travelers: number
  onChange: (travelers: number) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border border-line bg-paper-2 p-1 shadow-[0_10px_24px_-20px_rgba(88,61,43,0.6)]",
        className,
      )}
    >
      <button
        type="button"
        aria-label="减少出行人"
        onClick={() => onChange(Math.max(1, travelers - 1))}
        disabled={travelers <= 1}
        className="grid size-8 place-items-center rounded-full text-ink-soft transition hover:bg-paper-3 disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-6 text-center text-sm font-bold text-ink">{travelers}</span>
      <button
        type="button"
        aria-label="添加出行人"
        onClick={() => onChange(Math.min(MAX_TRAVELERS, travelers + 1))}
        disabled={travelers >= MAX_TRAVELERS}
        className="grid size-8 place-items-center rounded-full bg-brand text-[#fff8f1] shadow-sm shadow-brand/30 transition hover:bg-brand-deep disabled:opacity-40"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
