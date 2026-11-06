import { useEffect, useMemo, useState } from "react"
import { Check, Search } from "lucide-react"

import { CountryFlag } from "@/client/components/visa/CountryFlag"
import { cn } from "@/client/lib/utils"
import {
  findCountry,
  VISA_COUNTRIES,
  VISA_GROUPS,
  type VisaCountry,
  type VisaGroupKey,
} from "@/shared/modules/visa/visa.catalog"
import {
  currencyOf,
  findOrigin,
  isDestinationOffline,
  visaPriceFor,
  type VisaOriginCode,
  type VisaSettings,
} from "@/shared/modules/visa/visa.settings"

const PALETTES = [
  { sky: ["#f7d9b6", "#e79a7e"], sun: "#fff1cf", ridge: "#b4715a", base: "#7c4a3a" },
  { sky: ["#f0dcb9", "#d9b279"], sun: "#fff7e2", ridge: "#b08a4e", base: "#7d5c33" },
  { sky: ["#dfe8cf", "#a9c79a"], sun: "#fbfff0", ridge: "#7a9c6a", base: "#4f6b48" },
  { sky: ["#cfe4e2", "#8fbfc0"], sun: "#fff8d6", ridge: "#5f9395", base: "#356469" },
  { sky: ["#f6e2c8", "#f3c48f"], sun: "#fffdf0", ridge: "#d39a5f", base: "#9a6a3d" },
  { sky: ["#f3d7d2", "#e2a39b"], sun: "#fff3ef", ridge: "#c07c72", base: "#8a5049" },
  { sky: ["#eee0ce", "#d6bca0"], sun: "#fffaf0", ridge: "#a98a68", base: "#755a40" },
  { sky: ["#e8e6cf", "#c9c79a"], sun: "#fbfff0", ridge: "#9a9a6c", base: "#6a6b48" },
]

function paletteFor(country: VisaCountry) {
  return PALETTES[VISA_COUNTRIES.indexOf(country) % PALETTES.length]
}

function firstOpenGroup(settings: VisaSettings, originCode: VisaOriginCode): VisaGroupKey {
  const open = VISA_GROUPS.find((item) =>
    VISA_COUNTRIES.some(
      (country) => country.group === item.key && !isDestinationOffline(settings, originCode, country.code),
    ),
  )
  return open?.key ?? VISA_GROUPS[0].key
}

export function CountryStep({
  settings,
  originCode,
  onOriginChange,
  selectedCode,
  onSelect,
}: {
  settings: VisaSettings
  originCode: VisaOriginCode
  onOriginChange: (code: VisaOriginCode) => void
  selectedCode: string
  onSelect: (code: string) => void
}) {
  const [group, setGroup] = useState<VisaGroupKey>(() => {
    const preferred = findCountry(selectedCode)
    if (preferred && !isDestinationOffline(settings, originCode, preferred.code)) {
      return preferred.group
    }
    return firstOpenGroup(settings, originCode)
  })
  const [query, setQuery] = useState("")
  const keyword = query.trim().toLowerCase()
  const origin = findOrigin(settings, originCode)

  // 这一组全下架了就直接落到下一个还有货的组；用户自己点回来的不拦
  useEffect(() => {
    setGroup((current) => {
      const open = VISA_COUNTRIES.some(
        (country) =>
          country.group === current && !isDestinationOffline(settings, originCode, country.code),
      )
      return open ? current : firstOpenGroup(settings, originCode)
    })
  }, [settings, originCode])

  const countries = useMemo(() => {
    const list = keyword
      ? VISA_COUNTRIES.filter((country) =>
          `${country.name} ${country.code} ${country.visa}`.toLowerCase().includes(keyword),
        )
      : VISA_COUNTRIES.filter((country) => country.group === group)

    // 下架的排到后面，可见的还是原来的次序
    return [...list].sort(
      (left, right) =>
        Number(isDestinationOffline(settings, originCode, left.code)) -
        Number(isDestinationOffline(settings, originCode, right.code)),
    )
  }, [keyword, group, settings, originCode])

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            先选一个目的地
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            价格按人计算（{origin?.label}出发）。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#6f5b4b]">出发地</span>
          <div className="flex rounded-full border border-line bg-paper-2 p-1">
            {settings.origins.map((item) => {
              const active = item.code === originCode
              return (
                <button
                  key={item.code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onOriginChange(item.code)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition",
                    active
                      ? "bg-brand text-[#fff8f1] shadow-sm shadow-brand/25"
                      : "text-ink-soft hover:text-brand",
                  )}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {VISA_GROUPS.map((item) => {
          const active = !keyword && item.key === group
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setGroup(item.key)
                setQuery("")
              }}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                active
                  ? "border-brand bg-brand text-[#fff8f1] shadow-sm shadow-brand/25"
                  : "border-line bg-paper-2 text-ink-soft hover:border-brand/40 hover:text-brand",
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`搜索 ${VISA_COUNTRIES.length} 个国家`}
          className="h-12 w-full rounded-full border border-line bg-paper-2 pl-12 pr-5 text-sm text-ink placeholder:text-ink-soft/70 focus:border-brand/50 focus:outline-none focus:ring-4 focus:ring-brand/10"
        />
      </div>

      {countries.length === 0 ? (
        <div className="mt-6 rounded-[28px] border border-dashed border-line py-14 text-center">
          <p className="text-sm font-medium text-ink">没有找到“{query}”</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-2 text-sm font-semibold text-brand"
          >
            清空搜索
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {countries.map((country) => (
            <CountryCard
              key={country.code}
              country={country}
              price={visaPriceFor(settings, originCode, country.code)}
              symbol={currencyOf(originCode).symbol}
              selected={country.code === selectedCode}
              offline={isDestinationOffline(settings, originCode, country.code)}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CountryCard({
  country,
  price,
  symbol,
  selected,
  offline,
  onSelect,
}: {
  country: VisaCountry
  price: number
  symbol: string
  selected: boolean
  offline: boolean
  onSelect: (code: string) => void
}) {
  const palette = paletteFor(country)

  return (
    <button
      type="button"
      disabled={offline}
      onClick={() => onSelect(country.code)}
      className={cn("group text-left focus:outline-none", offline && "cursor-not-allowed")}
    >
      <div
        className={cn(
          "relative aspect-[4/3] overflow-hidden rounded-[20px] ring-1 ring-[#3a2c25]/5 transition-all duration-300",
          offline
            ? "opacity-40 grayscale"
            : selected
              ? "ring-2 ring-brand shadow-lg shadow-brand/25"
              : "group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:shadow-[#5b3d2b]/15 group-focus-visible:ring-2 group-focus-visible:ring-brand",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 transition-transform duration-500",
            !offline && "group-hover:scale-[1.06]",
          )}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(150deg, ${palette.sky[0]}, ${palette.sky[1]})`,
            }}
          />
          <div
            className="absolute -right-4 -top-6 size-20 rounded-full opacity-90"
            style={{ background: palette.sun }}
          />
          <div
            className="absolute -left-6 bottom-0 h-[62%] w-[82%] rounded-t-[100%] opacity-60"
            style={{ background: palette.ridge }}
          />
          <div
            className="absolute -right-8 bottom-0 h-[46%] w-[72%] rounded-t-[100%] opacity-80"
            style={{ background: palette.base }}
          />
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#3a2c25]/70 via-[#3a2c25]/15 to-transparent" />
        </div>

        {country.badge && (
          <span className="absolute left-2 top-2 rounded-full bg-[#fff9ef]/90 px-2 py-0.5 text-[11px] font-semibold text-ink backdrop-blur-sm">
            {country.badge}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-1.5 px-2.5 pb-2.5">
          <span className="grid h-4.5 w-6.5 shrink-0 place-items-center overflow-hidden rounded-[3px] ring-1 ring-white/70">
            <CountryFlag code={country.code} className="size-full" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#fffaf3] drop-shadow">
            {country.name}
          </span>
          <span className="shrink-0 text-sm font-extrabold text-white [text-shadow:0_1px_4px_rgba(58,44,37,0.75)]">
            {symbol}
            {price}
          </span>
        </div>

        {selected && (
          <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-brand text-[#fff8f1] shadow">
            <Check className="size-3.5" />
          </span>
        )}
      </div>
    </button>
  )
}
