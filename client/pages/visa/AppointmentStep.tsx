import { CalendarDays } from "lucide-react"

import { cn } from "@/client/lib/utils"
import {
  materialDayState,
  type MaterialsPlan,
  type VisaCenter,
} from "@/shared/modules/visa/visa.settings"
import { MonthCalendar, isoDate, type DayState } from "@/client/components/visa/MonthCalendar"
import { StepCard } from "./StepCard"

function shortDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function AppointmentStep({
  visaCenter,
  centers,
  city,
  dates,
  note,
  plan,
  onChange,
}: {
  visaCenter: string
  centers: VisaCenter[]
  city: string
  dates: string[]
  note: string
  plan: MaterialsPlan
  onChange: (patch: { city?: string; dates?: string[]; note?: string }) => void
}) {
  const center = centers.find((item) => item.name === city)
  const available = center?.dates ?? []
  const caution = center?.cautionDates ?? []
  const today = isoDate(new Date())
  const selected = [...dates].sort()

  function manualState(iso: string): DayState {
    if (available.includes(iso)) return "available"
    if (caution.includes(iso)) return "caution"
    return "off"
  }

  function stateOf(iso: string): DayState {
    return materialDayState(plan, iso, manualState(iso))
  }

  const states = [...new Set([...available, ...caution])].map(stateOf)
  const openCount = states.filter((state) => state !== "off").length
  const cautionCount = states.filter((state) => state === "caution").length

  function toggle(iso: string) {
    onChange({
      dates: dates.includes(iso) ? dates.filter((item) => item !== iso) : [...dates, iso],
    })
  }

  return (
    <StepCard
      icon={CalendarDays}
      title="选择递签日期"
      subtitle={`${visaCenter} · 可多选`}
      hint="灰色日期暂未开放或名额已满；橙色日期制作周期紧张，不建议选择。"
    >
      <p className="text-xs font-semibold text-[#6f5b4b]">递签城市</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {centers.map((option) => (
          <button
            key={option.name}
            type="button"
            onClick={() =>
              onChange({ city: option.name, dates: option.name === city ? dates : [] })
            }
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
              city === option.name
                ? "border-brand bg-brand text-[#fff8f1] shadow-sm shadow-brand/30"
                : "border-line bg-paper-2 text-ink-soft hover:border-brand/40 hover:text-brand",
            )}
          >
            {option.name}
          </button>
        ))}
      </div>

      {city ? (
        <>
          <div className="mt-5">
            <p className="text-xs font-semibold text-[#6f5b4b]">递签日期</p>

            <MonthCalendar
              className="mt-1"
              selected={dates}
              months={1}
              stateOf={stateOf}
              canSelect={(iso) => iso >= today && stateOf(iso) !== "off"}
              onToggle={toggle}
            />

            {openCount === 0 && (
              <p className="mt-2 text-xs font-medium text-brand-deep">
                {available.length + caution.length === 0
                  ? "该签证中心暂未开放可约号源。"
                  : "近期名额已满，请往后翻看其他月份。"}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-soft">
              <span className="flex items-center gap-1.5">
                <i className="size-2.5 rounded-full bg-[#e8f0dc]" />
                可预约
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2.5 rounded-full bg-[#fbe3cd]" />
                档期紧张
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2.5 rounded-full border border-line bg-paper-2" />
                不可选
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs sm:gap-2">
            <span className="text-ink-soft">
              {selected.length ? `已选 ${selected.length} 天` : "请选择递签日期"}
            </span>
            {selected.map((iso) => (
              <span
                key={iso}
                className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-deep sm:px-2.5 sm:py-1 sm:text-xs"
              >
                {shortDate(iso)}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-soft/70">
            * 使馆号源实时变动，建议多选几个备选日期以提高预约成功率。
          </p>
        </>
      ) : null}

      <div className="mt-5 border-t border-line pt-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-[#6f5b4b]">备注（可选）</span>
          <span className="text-[11px] text-ink-soft/70">{note.length}/300</span>
        </div>
        <textarea
          value={note}
          maxLength={300}
          rows={3}
          onChange={(event) => onChange({ note: event.target.value })}
          placeholder="例如：优先 8 月 16 日，不接受周三周四"
          className="mt-1.5 w-full resize-none rounded-xl border border-line bg-paper-3/60 px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand/50 focus:bg-paper-2 focus:outline-none focus:ring-4 focus:ring-brand/10"
        />
      </div>
    </StepCard>
  )
}
