import { useEffect, useRef, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card"
import { Button } from "@/client/components/ui/button"
import { Input } from "@/client/components/ui/input"
import { MonthCalendar, type DayState } from "@/client/components/visa/MonthCalendar"
import { cn } from "@/client/lib/utils"
import { visaApi } from "@/client/api/instance"
import { getAuth } from "@/client/methods/auth"
import { toast } from "@/client/methods/notify"
import { VISA_COUNTRIES } from "@/shared/modules/visa/visa.catalog"
import {
  currencyOf,
  findOrigin,
  materialsPlan,
  materialDayState,
  type VisaCenter,
  type VisaDestination,
  type VisaMaterials,
  type VisaOriginCode,
  type VisaSettings,
} from "@/shared/modules/visa/visa.settings"
import { parseCalendarScreenshot, type CalendarWord, type ScannedDay } from "./calendarScan"

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("读取文件失败"))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("图片读不出来"))
    image.src = src
  })
}

/** 每个字块里最深的像素：深色是可选，浅灰是被灰掉的 */
async function measureWords(
  image: HTMLImageElement,
  words: CalendarWord[],
): Promise<CalendarWord[]> {
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext("2d")
  if (!context) return words

  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data

  return words.map((word) => {
    let luma = 255
    const left = Math.max(0, Math.round(word.x))
    const right = Math.min(canvas.width, Math.round(word.x + word.width))
    const top = Math.max(0, Math.round(word.y))
    const bottom = Math.min(canvas.height, Math.round(word.y + word.height))

    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const index = (y * canvas.width + x) * 4
        const value = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2]
        if (value < luma) luma = value
      }
    }

    return { ...word, luma }
  })
}

export function VisaSettingsPage() {
  const [settings, setSettings] = useState<VisaSettings | null>(null)
  const [originCode, setOriginCode] = useState<VisaOriginCode>("CN")
  const [activeCenters, setActiveCenters] = useState<Record<string, number>>({})
  const [activeCountry, setActiveCountry] = useState(VISA_COUNTRIES[0]?.code ?? "")
  const [loading, setLoading] = useState(true)
  const [fx, setFx] = useState<{ rate: number; date: string; source: string } | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [undoStep, setUndoStep] = useState<{
    countryCode: string
    index: number
    dates: string[]
    cautionDates: string[]
  } | null>(null)
  // 改完就生效，所以记住上一次存进去的内容，避免回填时再存一遍
  const savedRef = useRef("")
  const loadedRef = useRef(false)

  const origin = settings ? findOrigin(settings, originCode) : null
  const plan = materialsPlan(settings)

  const activeCountryMeta = VISA_COUNTRIES.find((item) => item.code === activeCountry) ?? null
  const activeDestination = origin?.destinations[activeCountry] ?? null
  const activeIndex = activeDestination?.centers.length
    ? Math.min(activeCenters[activeCountry] ?? 0, activeDestination.centers.length - 1)
    : -1
  const activeCenter =
    activeDestination && activeIndex >= 0 ? activeDestination.centers[activeIndex] : undefined

  async function load() {
    setLoading(true)
    setLoadFailed(false)
    const res = await visaApi.settings({})
    setLoading(false)
    if (res.success && res.data?.settings) {
      setSettings(res.data.settings)
      savedRef.current = JSON.stringify(res.data.settings)
      loadedRef.current = true
    } else {
      setLoadFailed(true)
    }
  }

  async function loadFx() {
    const res = await visaApi.fx({})
    if (res.success) setFx(res.data?.fx ?? null)
  }

  useEffect(() => {
    load()
    void loadFx()
  }, [])

  function updateDestination(
    countryCode: string,
    updater: (destination: VisaDestination) => VisaDestination,
  ) {
    setSettings((current) => {
      if (!current) return current
      return {
        ...current,
        origins: current.origins.map((item) => {
          if (item.code !== originCode) return item
          return {
            ...item,
            destinations: {
              ...item.destinations,
              [countryCode]: updater(item.destinations[countryCode]),
            },
          }
        }),
      }
    })
  }

  function updateFee(value: number) {
    setSettings((current) => {
      if (!current) return current
      return {
        ...current,
        origins: current.origins.map((item) =>
          item.code === originCode ? { ...item, fee: Math.max(0, value) } : item,
        ),
      }
    })
  }

  function updateFx(value: number) {
    setSettings((current) => (current ? { ...current, fx_gbp_cny: Math.max(0, value) } : current))
  }

  function updateCenter(countryCode: string, index: number, patch: Partial<VisaCenter>) {
    updateDestination(countryCode, (destination) => ({
      ...destination,
      centers: destination.centers.map((center, i) =>
        i === index ? { ...center, ...patch } : center,
      ),
    }))
  }

  function paintDate(countryCode: string, index: number, iso: string, state: DayState) {
    updateDestination(countryCode, (destination) => {
      const center = destination.centers[index]
      if (!center) return destination
      const dates = center.dates.filter((date) => date !== iso)
      const cautionDates = center.cautionDates.filter((date) => date !== iso)
      if (state === "available") dates.push(iso)
      if (state === "caution") cautionDates.push(iso)

      return {
        ...destination,
        centers: destination.centers.map((item, i) =>
          i === index
            ? { ...item, dates: dates.sort(), cautionDates: cautionDates.sort() }
            : item,
        ),
      }
    })
  }

  function addCenter(countryCode: string, count: number) {
    updateDestination(countryCode, (item) => ({
      ...item,
      centers: [...item.centers, { name: "", dates: [], cautionDates: [] }],
    }))
    setActiveCenters((prev) => ({ ...prev, [countryCode]: count }))
  }

  function removeCenter(countryCode: string, index: number) {
    const active = activeCenters[countryCode] ?? 0
    const remaining = (origin?.destinations[countryCode]?.centers.length ?? 1) - 1
    updateDestination(countryCode, (item) => ({
      ...item,
      centers: item.centers.filter((_, i) => i !== index),
    }))
    setActiveCenters((prev) => ({
      ...prev,
      [countryCode]: Math.max(0, Math.min(index < active ? active - 1 : active, remaining - 1)),
    }))
  }

  function updateMaterials(patch: Partial<VisaMaterials>) {
    setSettings((current) =>
      current ? { ...current, materials: { ...current.materials, ...patch } } : current,
    )
  }

  async function persist(value: VisaSettings) {
    const payload = JSON.stringify(value)
    setSaving(true)
    const res = await visaApi.saveSettings({ settings: value, auth: getAuth() })
    setSaving(false)
    if (res.success) {
      savedRef.current = payload
      return
    }

    toast.error(res.message || "保存失败，请检查填写内容。")
  }

  // 每次改动停顿半秒就写回线上；中心名还没填完的那种半成品先不存
  useEffect(() => {
    if (!settings || !loadedRef.current) return
    if (JSON.stringify(settings) === savedRef.current) return
    const hasEmptyCenter = settings.origins.some((item) =>
      Object.values(item.destinations).some((destination) =>
        destination.centers.some((center) => !center.name.trim()),
      ),
    )
    if (hasEmptyCenter) return

    const timer = window.setTimeout(() => void persist(settings), 600)
    return () => window.clearTimeout(timer)
  }, [settings])

  function mergeScanned(center: VisaCenter, days: ScannedDay[]) {
    const dates = new Set(center.dates)
    const cautions = new Set(center.cautionDates)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const stats = { available: 0, caution: 0, cleared: 0 }
    for (const day of days) {
      if (!day.available) {
        if (dates.delete(day.iso) || cautions.delete(day.iso)) stats.cleared += 1
        continue
      }
      // 本来就是可选的不动
      if (dates.has(day.iso)) continue

      const gap = Math.round((Date.parse(day.iso) - today.getTime()) / 86400000)
      cautions.delete(day.iso)
      if (gap < 15) {
        cautions.add(day.iso)
        stats.caution += 1
      } else {
        dates.add(day.iso)
        stats.available += 1
      }
    }

    return {
      dates: [...dates].sort(),
      cautionDates: [...cautions].sort(),
      stats,
    }
  }

  function applyScan(days: ScannedDay[]) {
    if (!activeCenter || !activeDestination || activeIndex < 0) return

    const merged = mergeScanned(activeCenter, days)
    const countryCode = activeCountry
    const index = activeIndex
    const snapshot = {
      countryCode,
      index,
      dates: [...activeCenter.dates],
      cautionDates: [...activeCenter.cautionDates],
    }

    setSettings((current) => {
      if (!current) return current
      return {
        ...current,
        origins: current.origins.map((item) => {
          if (item.code !== originCode) return item
          const destination = item.destinations[countryCode]
          if (!destination) return item
          return {
            ...item,
            destinations: {
              ...item.destinations,
              [countryCode]: {
                ...destination,
                centers: destination.centers.map((center, position) =>
                  position === index
                    ? { ...center, dates: merged.dates, cautionDates: merged.cautionDates }
                    : center,
                ),
              },
            },
          }
        }),
      }
    })

    setUndoStep(snapshot)
    toast.success(
      `可选 +${merged.stats.available}、不建议 +${merged.stats.caution}、清掉 ${merged.stats.cleared}`,
    )
  }

  function undoScan() {
    if (!undoStep) return
    const snapshot = undoStep
    setUndoStep(null)
    setSettings((current) => {
      if (!current) return current
      return {
        ...current,
        origins: current.origins.map((item) => {
          if (item.code !== originCode) return item
          const destination = item.destinations[snapshot.countryCode]
          if (!destination) return item
          return {
            ...item,
            destinations: {
              ...item.destinations,
              [snapshot.countryCode]: {
                ...destination,
                centers: destination.centers.map((center, position) =>
                  position === snapshot.index
                    ? { ...center, dates: snapshot.dates, cautionDates: snapshot.cautionDates }
                    : center,
                ),
              },
            },
          }
        }),
      }
    })
  }

  async function scanCalendar(file: File) {
    setScanning(true)
    try {
      const dataUrl = await readAsDataUrl(file)
      const res = await visaApi.calendarScan({ image: dataUrl, auth: getAuth() })
      const words = res.data?.words ?? []
      if (!res.success || !words.length) {
        toast.error(res.message || "没认出日历里的数字")
        return
      }

      const image = await loadImageElement(dataUrl)
      const measured = await measureWords(
        image,
        words.map((word) => ({ ...word, luma: 255 })),
      )
      const days = parseCalendarScreenshot(measured)
      if (!days.length) {
        toast.error("这张图没认出可用的日历")
        return
      }
      applyScan(days)
    } catch {
      toast.error("识别失败，换张图试试")
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    async function onPaste(event: ClipboardEvent) {
      const items = Array.from(event.clipboardData?.items ?? [])
      const file = items.find((item) => item.type.startsWith("image/"))?.getAsFile()
      if (!file || !activeCenter) return
      event.preventDefault()
      await scanCalendar(file)
    }

    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">签证配置</h2>
          <p className="text-muted-foreground text-sm">
            按出发国 × 目的地维护签证费、可选签证中心，以及每个中心开放的可预约日期。
          </p>
        </div>
        <span className="text-muted-foreground pt-1 text-xs">
          {saving ? "保存中…" : "改动即时生效"}
        </span>
      </div>

      {settings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">材料组排期</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-4">
              <label className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">积压时长（工作日）</span>
                <Input
                  type="number"
                  min={0}
                  className="h-8 w-24"
                  value={settings.materials.workdays}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) =>
                    updateMaterials({ workdays: Math.max(0, Number(event.target.value) || 0) })
                  }
                />
              </label>
              <p className="text-muted-foreground pb-1.5 text-xs">
                最早可递签 {plan.firstDate}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {settings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">汇兑磨损</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-xs">每人</span>
              <Input
                type="number"
                min={0}
                step={1}
                className="h-8 w-24"
                value={origin?.fee ?? 0}
                onFocus={(event) => event.target.select()}
                onChange={(event) => updateFee(Number(event.target.value) || 0)}
              />
              <span className="text-muted-foreground text-xs">
                {currencyOf(originCode).symbol}，跟签证费一起收，为代付产生的汇兑与通道损耗
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      {settings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">汇率</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-xs">1 英镑 =</span>
              <span className="text-sm font-semibold">{fx ? fx.rate.toFixed(4) : "—"} 人民币</span>
              <Button size="sm" variant="outline" className="h-7" onClick={() => void loadFx()}>
                刷新
              </Button>
              <span className="text-muted-foreground text-xs">
                {fx
                  ? `${fx.date} · ${fx.source}，中间价加 0.5%，每 6 小时自动更新`
                  : "暂时查不到，用下面的手填汇率"}
              </span>
            </div>
            <label className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-xs">手填汇率</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                className="h-8 w-24"
                value={settings.fx_gbp_cny ?? 0}
                onFocus={(event) => event.target.select()}
                onChange={(event) => updateFx(Number(event.target.value) || 0)}
              />
              <span className="text-muted-foreground text-xs">
                填了就按这个收，留 0 用上面的自动汇率
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">出发地</span>
        <div className="flex gap-1 rounded-md border p-1">
          {settings?.origins.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                setOriginCode(item.code)
                setActiveCenters({})
              }}
              className={cn(
                "rounded px-3 py-1 text-sm font-medium transition-colors",
                item.code === originCode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-muted-foreground text-sm">正在加载…</p>}

      {loadFailed && (
        <div className="text-sm">
          <span className="text-destructive">配置加载失败。</span>
          <Button variant="link" className="h-auto p-0 pl-1" onClick={load}>
            重试
          </Button>
        </div>
      )}

      {origin && activeCountryMeta && activeDestination && (
        <>
          <div className="flex flex-wrap items-center gap-1 rounded-md border p-1">
            {VISA_COUNTRIES.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => setActiveCountry(country.code)}
                className={cn(
                  "rounded px-3 py-1 text-sm font-medium transition-colors",
                  country.code === activeCountry
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                  origin?.destinations[country.code]?.offline &&
                    country.code !== activeCountry &&
                    "line-through opacity-60",
                )}
              >
                {country.name}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {activeCountryMeta.name}
                  <span className="text-muted-foreground text-xs font-normal">
                    {activeCountryMeta.visa}
                  </span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {activeDestination.centers.length} 个中心
                  </span>
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateDestination(activeCountry, (item) => ({
                        ...item,
                        offline: !item.offline,
                      }))
                    }
                    className={cn(
                      "rounded px-3 py-1 text-xs font-medium transition-colors",
                      activeDestination.offline
                        ? "bg-destructive text-white"
                        : "text-muted-foreground hover:bg-accent border",
                    )}
                  >
                    {activeDestination.offline ? "已下架" : "下架"}
                  </button>
                  <span className="text-muted-foreground text-xs">
                    {currencyOf(originCode).symbol}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 w-20"
                    value={activeDestination.price}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) =>
                      updateDestination(activeCountry, (item) => ({
                        ...item,
                        price: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                  <span className="text-muted-foreground text-xs">/ 人</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-1 rounded-md border p-1">
                {activeDestination.centers.map((center, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() =>
                      setActiveCenters((prev) => ({ ...prev, [activeCountry]: index }))
                    }
                    className={cn(
                      "rounded px-3 py-1 text-sm font-medium transition-colors",
                      activeIndex === index
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {center.name.trim() || "未命名"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => addCenter(activeCountry, activeDestination.centers.length)}
                  className="text-muted-foreground hover:bg-accent flex items-center gap-1 rounded px-2 py-1 text-sm"
                >
                  <Plus className="size-4" />
                  添加
                </button>
              </div>

              {activeCenter ? (
                <div className="rounded-md border">
                  <div className="flex items-center gap-2 p-2">
                    <Input
                      value={activeCenter.name}
                      placeholder="签证中心名称"
                      className="h-8"
                      onChange={(event) =>
                        updateCenter(activeCountry, activeIndex, { name: event.target.value })
                      }
                    />
                    <span className="text-muted-foreground shrink-0 text-xs">
                      可选 {activeCenter.dates.length} · 不建议 {activeCenter.cautionDates.length}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      aria-label="删除签证中心"
                      onClick={() => removeCenter(activeCountry, activeIndex)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="border-t p-3">
                    <MonthCalendar
                      selected={[]}
                      months="auto"
                      stateOf={(iso) =>
                        materialDayState(
                          plan,
                          iso,
                          activeCenter.dates.includes(iso)
                            ? "available"
                            : activeCenter.cautionDates.includes(iso)
                              ? "caution"
                              : "off",
                        )
                      }
                      canSelect={(iso) => iso >= plan.firstDate}
                      onPaint={(iso, state) => paintDate(activeCountry, activeIndex, iso, state)}
                    />
                    <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5">
                        <i className="size-2.5 rounded-full bg-[#e8f0dc]" />
                        可选（浅绿）
                      </span>
                      <span className="flex items-center gap-1.5">
                        <i className="size-2.5 rounded-full bg-[#fbe3cd]" />
                        不建议选（橙）
                      </span>
                      <span className="flex items-center gap-1.5">
                        <i className="size-2.5 rounded-full border bg-muted" />
                        不可选（灰）
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      左键拖动标可选，右键标不建议选；从已标色的日期起拖是擦除。排期内的日期由上面的积压时长决定。
                    </p>
                    <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span>
                        {scanning
                          ? "正在看这张图…"
                          : "直接粘贴签证中心的档期截图，识别这个月和下个月的可选日期。"}
                      </span>
                      {undoStep && (
                        <button
                          type="button"
                          onClick={undoScan}
                          className="text-[#a2601f] underline underline-offset-2"
                        >
                          撤销上一次粘贴
                        </button>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  这个目的地还没有签证中心，点上面的「添加」。
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {settings && (
        <p className="text-muted-foreground text-xs">
          改动只影响之后的预定。
        </p>
      )}
    </div>
  )
}
