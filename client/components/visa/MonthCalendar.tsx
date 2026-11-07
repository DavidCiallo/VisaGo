import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/client/lib/utils"

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"]

export type DayState = "available" | "caution" | "off"

export function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function monthCells(month: Date): (string | null)[] {
  const year = month.getFullYear()
  const index = month.getMonth()
  const offset = (new Date(year, index, 1).getDay() + 6) % 7
  const total = new Date(year, index + 1, 0).getDate()
  const cells: (string | null)[] = Array(offset).fill(null)
  for (let day = 1; day <= total; day++) {
    cells.push(isoDate(new Date(year, index, day)))
  }
  return cells
}

function addMonths(month: Date, count: number) {
  return new Date(month.getFullYear(), month.getMonth() + count, 1)
}

function monthLabel(month: Date) {
  return `${month.getFullYear()}年${month.getMonth() + 1}月`
}

/** 默认显示本月 + 下个月；已经进了当月最后一周，就顺延到下个月 + 下下个月。 */
function initialWindowStart() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return now.getDate() > daysInMonth - 7 ? addMonths(start, 1) : start
}

export function MonthCalendar({
  selected,
  stateOf,
  canSelect,
  onToggle,
  onPaint,
  months = "auto",
  className,
}: {
  selected: string[]
  stateOf: (iso: string) => DayState
  canSelect: (iso: string) => boolean
  onToggle?: (iso: string) => void
  /** 传了就支持拖拽涂色：左键标可选，右键标不建议选，从已标色的日期起拖是擦除 */
  onPaint?: (iso: string, state: DayState) => void
  /** "auto" 宽屏两月、窄屏一月 */
  months?: 1 | 2 | "auto"
  className?: string
}) {
  const [start, setStart] = useState(initialWindowStart)
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 640px)").matches)
  const painting = useRef<DayState | null>(null)
  const now = new Date()
  const canGoPrev = start > new Date(now.getFullYear(), now.getMonth(), 1)
  const count = months === "auto" ? (wide ? 2 : 1) : months
  const visible = Array.from({ length: count }, (_, index) => addMonths(start, index))

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)")
    const update = () => setWide(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    const stop = () => {
      painting.current = null
    }
    window.addEventListener("mouseup", stop)
    return () => window.removeEventListener("mouseup", stop)
  }, [])

  function beginPaint(iso: string, button: number) {
    if (!onPaint || !canSelect(iso)) return
    const current = stateOf(iso)
    const next: DayState =
      button === 2
        ? current === "caution"
          ? "off"
          : "caution"
        : current === "available"
          ? "off"
          : "available"
    painting.current = next
    onPaint(iso, next)
  }

  function continuePaint(iso: string) {
    const target = painting.current
    if (!onPaint || !target || !canSelect(iso)) return
    if (stateOf(iso) !== target) onPaint(iso, target)
  }

  return (
    <div className={cn("select-none", className)}>
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          aria-label="上个月"
          disabled={!canGoPrev}
          onClick={() => setStart(addMonths(start, -1))}
          className="grid size-7 place-items-center rounded-full border border-line bg-paper-2 text-ink-soft transition hover:border-brand/40 hover:text-brand disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="下个月"
          onClick={() => setStart(addMonths(start, 1))}
          className="grid size-7 place-items-center rounded-full border border-line bg-paper-2 text-ink-soft transition hover:border-brand/40 hover:text-brand"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className={cn("mt-1 grid gap-x-6 gap-y-5", count > 1 && "sm:grid-cols-2")}>
        {visible.map((month) => (
          <div key={monthLabel(month)}>
            <p className="pb-1.5 text-center text-xs font-semibold text-ink">
              {monthLabel(month)}
            </p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((label) => (
                <span
                  key={label}
                  className="pb-1 text-center text-[11px] font-semibold text-ink-soft"
                >
                  {label}
                </span>
              ))}
              {monthCells(month).map((iso, index) => {
                if (!iso) return <span key={`blank-${index}`} />
                const state = stateOf(iso)
                const selectable = canSelect(iso)
                const active = selected.includes(iso)
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!selectable}
                    aria-pressed={active}
                    onMouseDown={(event) => beginPaint(iso, event.button)}
                    onMouseEnter={() => continuePaint(iso)}
                    onContextMenu={(event) => event.preventDefault()}
                    onClick={(event) => {
                      if (!onPaint) {
                        onToggle?.(iso)
                        return
                      }
                      // 鼠标点击已经在 mousedown 处理，这里只接键盘的 Enter / 空格
                      if (event.detail === 0) {
                        onPaint(iso, stateOf(iso) === "off" ? "available" : "off")
                      }
                    }}
                    className={cn(
                      "h-10 rounded-xl text-sm font-semibold transition",
                      active
                        ? "bg-brand text-[#fff8f1] shadow-sm shadow-brand/25"
                        : !selectable
                          ? "cursor-not-allowed text-ink-soft/25"
                          : state === "caution"
                            ? "bg-[#fbe3cd] text-[#a2601f] hover:bg-[#f6d3ac]"
                            : state === "available"
                              ? "bg-[#e8f0dc] text-[#4c6b3a] hover:bg-[#dbe8c8]"
                              : "text-ink-soft/60 hover:bg-paper-3",
                    )}
                  >
                    {Number(iso.slice(8))}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
