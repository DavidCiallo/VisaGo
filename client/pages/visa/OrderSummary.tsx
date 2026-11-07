import { ShieldCheck, Wallet } from "lucide-react"

import { CountryFlag } from "@/client/components/visa/CountryFlag"
import {
  quoteVisa,
  VISA_EXTRA_FEE,
  VISA_SLOT_SUPPORT_LABELS,
  type VisaCountry,
  type VisaSlotSupport,
} from "@/shared/modules/visa/visa.catalog"
import { currencyOf, type VisaOrigin } from "@/shared/modules/visa/visa.settings"

export function prettyDate(date: string) {
  const text = date.trim()
  if (!text) return ""
  // 出行日期允许写「2027年3月中旬」这种自由文本，不是 ISO 日期就原样显示
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text)) return text
  return new Date(`${text}T00:00:00`).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function shortDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function OrderSummary({
  country,
  origin,
  visaPrice,
  travelers,
  flight,
  hotel,
  appointmentCity,
  appointmentDates,
  appointmentNote,
  travelDate,
  tripDays,
  slotSupport,
}: {
  country: VisaCountry | null
  origin: VisaOrigin | null
  visaPrice: number
  travelers: number
  flight: boolean
  hotel: boolean
  appointmentCity: string
  appointmentDates: string[]
  appointmentNote: string
  travelDate: string
  tripDays: number
  slotSupport: VisaSlotSupport
}) {
  const quote = quoteVisa(visaPrice, travelers, flight, hotel)
  const symbol = currencyOf(origin?.code ?? "CN").symbol
  const perTraveler = travelers > 1 ? ` × ${travelers}` : ""
  const dates = [...appointmentDates].sort()

  return (
    <aside className="animate-in fade-in space-y-3 duration-300">
      <div className="overflow-hidden rounded-[28px] border border-line bg-paper-2 shadow-[0_18px_40px_-32px_rgba(88,61,43,0.55)]">
        <div className="flex items-center justify-between gap-3 bg-ink px-5 py-3 text-[#fff8f1]">
          <span className="flex items-center gap-2 text-sm font-bold">
            <Wallet className="size-4" />
            费用明细
          </span>
          {country && (
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-white/20">
              <span className="grid h-3.5 w-[18px] shrink-0 place-items-center overflow-hidden rounded-[2px] ring-1 ring-white/50">
                <CountryFlag code={country.code} className="size-full" />
              </span>
              {country.visa}
            </span>
          )}
        </div>

        <div className="p-5">
          {country && (
            <>
              <p className="text-sm font-bold text-ink">{country.name}</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {origin?.label}出发 · 签证费 {symbol}
                {visaPrice}/人
              </p>
            </>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-soft">出行人数</p>
            <p className="text-sm font-medium text-ink">{travelers} 人</p>
          </div>
          <p className="mt-2 text-xs font-medium text-brand-deep">
            服务费全免，签证费按官方标准代收。
          </p>

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-soft">签证费 · 代官方收取{perTraveler}</dt>
              <dd className="font-medium text-ink">
                {symbol}
                {quote.visaFee}
              </dd>
            </div>
            {flight && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-soft">机票预订单{perTraveler}</dt>
                <dd className="font-medium text-ink">
                  {symbol}
                  {VISA_EXTRA_FEE * travelers}
                </dd>
              </div>
            )}
            {hotel && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-soft">酒店预订单{perTraveler}</dt>
                <dd className="font-medium text-ink">
                  {symbol}
                  {VISA_EXTRA_FEE * travelers}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex items-end justify-between border-t border-dashed border-line pt-4">
            <div>
              <p className="text-sm font-bold text-ink">总价</p>
            </div>
            <p className="text-2xl font-extrabold text-brand">
              {symbol}
              {quote.toPay}
            </p>
          </div>

          <div className="mt-4 flex gap-2 rounded-2xl bg-mint/10 p-3 text-xs leading-relaxed text-[#4f5c3f]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>如果没能约到递签日期，全额退款。</span>
          </div>
        </div>
      </div>

      {(appointmentCity || travelDate) && (
        <div className="rounded-[28px] border border-line bg-paper-2/70 p-4 text-xs">
          <p className="font-bold text-ink">行程概览</p>
          <div className="mt-2 space-y-1 text-ink-soft">
            {appointmentCity && (
              <p>
                递签：{appointmentCity}
                {dates.length ? ` · ${dates.map(shortDate).join("、")}` : ""}
              </p>
            )}
            {travelDate && (
              <p>
                出行：{prettyDate(travelDate)}
                {tripDays ? ` · ${tripDays} 天` : ""}
              </p>
            )}
            {appointmentNote && <p>备注：{appointmentNote}</p>}
            <p>刷位：{VISA_SLOT_SUPPORT_LABELS[slotSupport]}</p>
          </div>
        </div>
      )}
    </aside>
  )
}
