import type { VisaOcrWord } from "@/shared/modules/visa/visa.interface"

export interface ScannedDay {
  iso: string
  available: boolean
}

/** 从截图里量出来的字：位置加上这块字最深的那颗像素 */
export interface CalendarWord extends VisaOcrWord {
  luma: number
}

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const WEEKDAYS_EN = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
const WEEKDAYS_ZH = ["一", "二", "三", "四", "五", "六", "日"]

function weekdayIndex(text: string): number {
  const lower = text.trim().toLowerCase()
  const english = WEEKDAYS_EN.findIndex((name) => lower.startsWith(name))
  if (english >= 0) return english
  return WEEKDAYS_ZH.indexOf(text.trim())
}

function monthOf(text: string): { year: number; month: number } | null {
  const chinese = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(text)
  if (chinese) return { year: Number(chinese[1]), month: Number(chinese[2]) }

  const english = /([A-Za-z]{3,9})\.?\s*(\d{4})/.exec(text)
  if (english) {
    const month = MONTHS[english[1].toLowerCase()]
    if (month) return { year: Number(english[2]), month }
  }

  const bare = /^(\d{1,2})\s*月$/.exec(text.trim())
  if (bare) return { year: new Date().getFullYear(), month: Number(bare[1]) }

  return null
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function groupLines(words: CalendarWord[]): CalendarWord[][] {
  const lines: CalendarWord[][] = []
  for (const word of [...words].sort((a, b) => a.y - b.y)) {
    const line = lines.find((row) => Math.abs(row[0].y - word.y) < Math.max(8, row[0].height * 0.6))
    if (line) line.push(word)
    else lines.push([word])
  }
  return lines.map((row) => row.sort((a, b) => a.x - b.x))
}

/** 一天的字越深说明这天是亮的，浅灰就是被灰掉的 */
const DARK_ENOUGH = 150

export function parseCalendarScreenshot(
  words: CalendarWord[],
  fallbackYear = new Date().getFullYear(),
): ScannedDay[] {
  const lines = groupLines(words)
  const heads = lines
    .map((row, index) => ({ index, text: row.map((word) => word.text).join(" "), row }))
    .filter((item) => monthOf(item.text))

  const found = new Map<string, { available: boolean; distance: number }>()

  for (let h = 0; h < heads.length; h++) {
    const head = heads[h]
    const title = monthOf(head.text)!
    const year = title.year || fallbackYear
    const month = title.month

    const headerY = head.row[0].y
    // 这个月的星期表头：标题下面第一行带星期名的
    const weekdayLine = lines.find((row) => {
      const labels = row.filter((word) => weekdayIndex(word.text) >= 0 && word.text.trim().length <= 9)
      return labels.length >= 5 && row[0].y > headerY
    })
    if (!weekdayLine) continue

    const columns = weekdayLine
      .filter((word) => weekdayIndex(word.text) >= 0)
      .sort((a, b) => a.x - b.x)
      .map((word) => ({ weekday: weekdayIndex(word.text), center: word.x + word.width / 2 }))
    if (columns.length < 5) continue

    const gap =
      columns.length > 1
        ? (columns[columns.length - 1].center - columns[0].center) / (columns.length - 1)
        : columns[0].center

    // 下一个月标题之后就不属于这个月了
    const nextHead = heads[h + 1]
    const bottom = nextHead ? nextHead.row[0].y : Number.POSITIVE_INFINITY
    const top = weekdayLine[0].y + weekdayLine[0].height * 0.6

    for (const word of words) {
      if (!/^\d{1,2}$/.test(word.text.trim())) continue
      if (word.y < top || word.y > bottom) continue

      const day = Number(word.text)
      if (day < 1 || day > daysInMonth(year, month)) continue

      const expected = (new Date(year, month - 1, day).getDay() + 6) % 7
      const column = columns.find((item) => item.weekday === expected)
      if (!column) continue

      const center = word.x + word.width / 2
      const distance = Math.abs(center - column.center)
      if (distance > gap * 0.5) continue

      const iso = isoDate(year, month, day)
      const previous = found.get(iso)
      if (previous && previous.distance <= distance) continue

      found.set(iso, { available: word.luma < DARK_ENOUGH, distance })
    }
  }

  return [...found.entries()]
    .map(([iso, value]) => ({ iso, available: value.available }))
    .sort((a, b) => a.iso.localeCompare(b.iso))
}
