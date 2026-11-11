import { BedDouble, Check, Plane, Plus, Ticket } from "lucide-react"

import { cn } from "@/client/lib/utils"
import { VISA_EXTRA_FEE, VISA_EXTRAS } from "@/shared/modules/visa/visa.catalog"
import { StepCard } from "./StepCard"

export function ExtrasStep({
  travelers,
  flight,
  hotel,
  symbol,
  onChange,
}: {
  travelers: number
  flight: boolean
  hotel: boolean
  symbol: string
  onChange: (patch: { flight?: boolean; hotel?: boolean }) => void
}) {
  const both = flight && hotel
  const bothPrice = VISA_EXTRA_FEE * 2 * travelers

  return (
    <StepCard
      icon={Ticket}
      title="附加材料"
      subtitle="按需添加。"
      hint="仅提供送签专用的行程预订单，出签后的实际机酒请自行预订。"
    >
      <div className="mb-3 flex items-center justify-between gap-3 rounded-[20px] bg-paper-3/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">机酒预订单</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ flight: !both, hotel: !both })}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition",
            both
              ? "border border-line bg-paper-2 text-ink-soft hover:text-ink"
              : "bg-brand text-[#fff8f1] shadow-sm shadow-brand/30 hover:bg-brand-deep",
          )}
        >
          {both ? "全部移除" : `机酒打包加购 ${symbol}${bothPrice}`}
        </button>
      </div>

      <div className="space-y-3">
        {VISA_EXTRAS.map((extra) => (
          <ExtraRow
            key={extra.key}
            icon={extra.key === "flight" ? Plane : BedDouble}
            name={extra.name}
            desc={extra.desc}
            travelers={travelers}
            symbol={symbol}
            added={extra.key === "flight" ? flight : hotel}
            onToggle={() => onChange({ [extra.key]: !(extra.key === "flight" ? flight : hotel) })}
          />
        ))}
      </div>

      <p className="mt-4 text-[11px] text-ink-soft/80">
        * 机酒信息是签证材料的常规要求。
      </p>
    </StepCard>
  )
}

function ExtraRow({
  icon: Icon,
  name,
  desc,
  travelers,
  symbol,
  added,
  onToggle,
}: {
  icon: typeof Plane
  name: string
  desc: string
  travelers: number
  symbol: string
  added: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[20px] border p-4 transition",
        added ? "border-brand bg-brand-soft/50" : "border-line bg-paper-2",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          added ? "bg-brand text-[#fff8f1]" : "bg-paper-3 text-ink-soft",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{name}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{desc}</p>
        <p className="mt-1 text-xs font-medium text-ink-soft/80">
          每人 {symbol}
          {VISA_EXTRA_FEE}
          {travelers > 1 ? ` · 共 ${travelers} 人` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={added ? `取消${name}` : `加购${name}`}
        aria-pressed={added}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full transition",
          added
            ? "bg-brand text-[#fff8f1] shadow-sm shadow-brand/30"
            : "border border-line bg-paper-2 text-ink hover:border-brand/50 hover:text-brand",
        )}
      >
        {added ? <Check className="size-4" /> : <Plus className="size-4" />}
      </button>
    </div>
  )
}
