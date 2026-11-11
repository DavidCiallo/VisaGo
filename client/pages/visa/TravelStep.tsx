import { Route } from "lucide-react"

import { cn } from "@/client/lib/utils"
import { StepCard } from "./StepCard"

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-paper-3/60 px-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand/50 focus:bg-paper-2 focus:outline-none focus:ring-4 focus:ring-brand/10"

export function TravelStep({
  latestAppointment,
  travelDate,
  tripDays,
  onChange,
}: {
  latestAppointment: string
  travelDate: string
  tripDays: number
  onChange: (patch: { travelDate?: string; tripDays?: number }) => void
}) {
  const travelTooEarly = Boolean(
    /^\d{4}-\d{2}-\d{2}$/.test(travelDate) &&
      latestAppointment &&
      travelDate <= latestAppointment,
  )
  const tripInvalid = !Number.isInteger(tripDays) || tripDays < 1 || tripDays > 180

  return (
    <StepCard
      icon={Route}
      title="出行计划"
      subtitle="出行日期和停留天数。"
      hint="天数包含入境与离境当天。"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[#6f5b4b]">计划出行日期</span>
          <input
            type="text"
            value={travelDate}
            onChange={(event) => onChange({ travelDate: event.target.value })}
            placeholder="例如：2027-03-01 或 2027年3月中旬"
            maxLength={40}
            className={inputClass}
          />
          {travelTooEarly && (
            <span className="mt-1 block text-[11px] text-brand-deep">
              出发日期必须晚于您选择的最后一个递签日期。
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-[#6f5b4b]">预计停留天数</span>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={180}
              value={tripDays}
              onChange={(event) => onChange({ tripDays: Number(event.target.value) })}
              className={cn(inputClass, "mt-0 w-28")}
            />
            <span className="text-sm text-ink-soft">天</span>
          </div>
          {tripInvalid && (
            <span className="mt-1 block text-[11px] text-brand-deep">停留天数需在 1 至 180 天之间。</span>
          )}
        </label>
      </div>

      <div className="mt-5 space-y-1.5 rounded-[20px] bg-paper-3/60 p-4 text-xs leading-relaxed text-ink-soft">
        <p>* 若行程未定，可先填大致日期，后续专员将与您核对。</p>
        <p>* 请确保递签日与出发日之间预留充足的使馆审理时间。</p>
      </div>
    </StepCard>
  )
}
