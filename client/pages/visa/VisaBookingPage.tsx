import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react"

import { VisaFooter, VisaHeader } from "@/client/components/visa/VisaHeader"
import { CountryFlag } from "@/client/components/visa/CountryFlag"
import { cn } from "@/client/lib/utils"
import { visaApi } from "@/client/api/instance"
import { toast } from "@/client/methods/notify"
import { findCountry, normalizeSlotSupport, quoteVisa, type VisaSlotSupport } from "@/shared/modules/visa/visa.catalog"
import {
  centersFor,
  currencyOf,
  symbolOf,
  findDestination,
  findOrigin,
  feeOf,
  isDestinationOffline,
  materialsPlan,
  visaPriceFor,
  type VisaOriginCode,
  type VisaSettings,
} from "@/shared/modules/visa/visa.settings"
import type { PassportDetails, VisaOrderDTO } from "@/shared/modules/visa/visa.entity"
import { EMAIL_PATTERN, type VisaOrderBrief, type VisaPayCode } from "@/shared/modules/visa/visa.interface"
import { CountryStep } from "./CountryStep"
import { IdentityStep, VisaMark } from "./IdentityStep"
import { TravelersStep } from "./TravelersStep"
import { ExtrasStep } from "./ExtrasStep"
import { PassportStep } from "./PassportStep"
import { AppointmentStep } from "./AppointmentStep"
import { SlotSupportStep } from "./SlotSupportStep"
import { TravelStep } from "./TravelStep"
import { OrderSummary } from "./OrderSummary"

const STEPS = [
  "选择国家",
  "出行人数",
  "附加服务",
  "护照信息",
  "递签日期",
  "加急抢号",
  "出行计划",
  "确认订单",
]

const emptyPassport: PassportDetails = {
  first_name: "",
  last_name: "",
  phone: "",
  birth_date: "",
  gender: "",
  nationality: "",
  birth_place: "",
  passport_number: "",
  issue_date: "",
  expiry_date: "",
}

const DRAFT_KEY = "visa_booking_draft_v1"

/** 隔天再回来，价格、档期都变了，续填反而是坑。 */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

interface VisaDraft {
  version?: number
  updated_at?: number
  customer_email: string
  customer_name: string
  verified: boolean
  origin_code: VisaOriginCode
  country_code: string
  travelers: number
  flight: boolean
  hotel: boolean
  passports: PassportDetails[]
  appointment_city: string
  appointment_dates: string[]
  appointment_note: string
  travel_date: string
  trip_days: number
  slot_support?: string
  step: number
}

export function VisaBookingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useState<VisaSettings | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const [originCode, setOriginCode] = useState<VisaOriginCode>("CN")
  const [email, setEmail] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [phase, setPhase] = useState<"email" | "name">("email")
  const [emailExists, setEmailExists] = useState<boolean | null>(null)
  const [verified, setVerified] = useState(false)
  const [history, setHistory] = useState<VisaOrderBrief[]>([])
  const [entering, setEntering] = useState(false)
  const [checking, setChecking] = useState(false)
  const [identityError, setIdentityError] = useState("")
  const [countryCode, setCountryCode] = useState("")
  const [travelers, setTravelers] = useState(1)
  const [flight, setFlight] = useState(true)
  const [hotel, setHotel] = useState(true)
  const [passports, setPassports] = useState<PassportDetails[]>([{ ...emptyPassport }])
  const [city, setCity] = useState("")
  const [dates, setDates] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [slotSupport, setSlotSupport] = useState<VisaSlotSupport>("maybe")
  const [travelDate, setTravelDate] = useState("")
  const [tripDays, setTripDays] = useState(7)

  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<VisaOrderDTO | null>(null)
  const [payCode, setPayCode] = useState<VisaPayCode | null>(null)
  const restored = useRef(false)

  const country = findCountry(countryCode)
  const origin = settings ? findOrigin(settings, originCode) : null
  const destination = settings ? findDestination(settings, originCode, countryCode) : null
  const centers = settings ? centersFor(settings, originCode, countryCode) : []
  const visaPrice = settings ? visaPriceFor(settings, originCode, countryCode) : 0
  const plan = materialsPlan(settings)
  const symbol = currencyOf(originCode).symbol

  const anyFilled = passports.some((item) => item.first_name.trim() && item.last_name.trim())
  const phoneValid = /^\+?\d{6,15}$/.test((passports[0]?.phone ?? "").replace(/[\s-]/g, ""))
  // 从订单页跳过来时带着订单号，验完身份直接回去
  const pendingOrder = (searchParams.get("order") ?? "").trim().toLowerCase()
  const latestAppointment = dates.length ? [...dates].sort()[dates.length - 1] : ""
  const isLastStep = step === STEPS.length - 1
  const quote = quoteVisa(visaPrice, travelers, flight, hotel, feeOf(origin))
  const tripValid = Number.isInteger(tripDays) && tripDays >= 1 && tripDays <= 180
  const travelTooEarly = Boolean(
    /^\d{4}-\d{2}-\d{2}$/.test(travelDate) &&
      latestAppointment &&
      travelDate <= latestAppointment,
  )

  const canContinue = [
    Boolean(countryCode),
    travelers >= 1,
    true,
    anyFilled && phoneValid,
    Boolean(city) && dates.length > 0,
    true,
    Boolean(travelDate.trim()) && tripValid && !travelTooEarly,
    true,
  ][step]

  async function loadSettings() {
    setLoadFailed(false)
    const res = await visaApi.settings({})
    if (res.success && res.data?.settings) {
      setSettings(res.data.settings)
      return
    }
    setLoadFailed(true)
  }

  useEffect(() => {
    loadSettings()
  }, [])

  // 走进来的草稿里可能是一个刚被下架的目的地
  useEffect(() => {
    if (!settings || !countryCode) return
    if (isDestinationOffline(settings, originCode, countryCode)) setCountryCode("")
  }, [settings, originCode, countryCode])

  // 从订单详情点「返回订单列表」时，按本机记下的身份直接回到列表
  useEffect(() => {
    if (!searchParams.get("list")) return

    const owner = localStorage.getItem("visa_owner")
    if (!owner) return

    let parsed: { email?: string; name?: string }
    try {
      parsed = JSON.parse(owner)
    } catch {
      return
    }
    const ownerEmail = (parsed.email ?? "").trim()
    const ownerName = (parsed.name ?? "").trim()
    if (!ownerEmail || !ownerName) return

    setEmail(ownerEmail)
    setCustomerName(ownerName)
    setPhase("name")

    void (async () => {
      const res = await visaApi.identify({ email: ownerEmail, name: ownerName })
      if (!(res.success && res.data?.ok)) return
      for (const item of res.data.keys ?? []) {
        if (item.key) localStorage.setItem(`visa_order_key_${item.token}`, item.key)
      }
      setVerified(true)
      setHistory(res.data.orders ?? [])
      setEntering(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!settings || restored.current) return
    restored.current = true

    // 从首页点「开始申请」是开新的一单，不带上次没填完的东西
    if (searchParams.get("new")) {
      localStorage.removeItem(DRAFT_KEY)
      navigate("/apply", { replace: true })
      return
    }

    if (searchParams.get("list")) return

    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return

    try {
      const draft = JSON.parse(raw) as VisaDraft
      const updatedAt = Number(draft.updated_at ?? 0)
      if (!updatedAt || Date.now() - updatedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(DRAFT_KEY)
        return
      }

      if (
        !findOrigin(settings, draft.origin_code) ||
        (draft.country_code && !findCountry(draft.country_code))
      ) {
        localStorage.removeItem(DRAFT_KEY)
        return
      }

      const destination = draft.country_code
        ? findDestination(settings, draft.origin_code, draft.country_code)
        : null
      const center = destination?.centers.find((item) => item.name === draft.appointment_city)
      const bookable = new Set([...(center?.dates ?? []), ...(center?.cautionDates ?? [])])
      const draftDates = center
        ? (Array.isArray(draft.appointment_dates) ? draft.appointment_dates : []).filter((date) =>
            bookable.has(date),
          )
        : []

      setEmail(draft.customer_email ?? "")
      setCustomerName(draft.customer_name ?? "")
      setVerified(Boolean(draft.verified))
      setOriginCode(draft.origin_code)
      setCountryCode(draft.country_code)
      setTravelers(draft.travelers)
      setFlight(Boolean(draft.flight))
      setHotel(Boolean(draft.hotel))
      setPassports(
        Array.isArray(draft.passports) && draft.passports.length
          ? draft.passports
          : [{ ...emptyPassport }],
      )
      setCity(center?.name ?? "")
      setDates(draftDates)
      setNote(draft.appointment_note ?? "")
      setTravelDate(draft.travel_date ?? "")
      setTripDays(draft.trip_days || 7)
      setSlotSupport(normalizeSlotSupport(draft.slot_support))
      // 旧草稿把「确认身份」算作第一步，序号要往前挪一格
      const savedStep = Number(draft.step ?? 0)
      const offset = draft.version === 2 ? 0 : 1
      setStep(Math.min(Math.max(savedStep - offset, 0), STEPS.length - 1))
      toast("已恢复上次未完成的订单", "info", {
        label: "重新开始",
        onClick: () => reset(),
      })
    } catch {
      localStorage.removeItem(DRAFT_KEY)
    }
  }, [settings])

  useEffect(() => {
    if (!restored.current || !settings || order) return
    if (!verified && !countryCode) return

    const draft: VisaDraft = {
      version: 2,
      updated_at: Date.now(),
      customer_email: email,
      customer_name: customerName,
      verified,
      origin_code: originCode,
      country_code: countryCode,
      travelers,
      flight,
      hotel,
      passports,
      appointment_city: city,
      appointment_dates: dates,
      appointment_note: note,
      travel_date: travelDate,
      trip_days: tripDays,
      slot_support: slotSupport,
      step,
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [
    settings,
    order,
    email,
    customerName,
    verified,
    originCode,
    countryCode,
    travelers,
    flight,
    hotel,
    passports,
    city,
    dates,
    note,
    slotSupport,
    travelDate,
    tripDays,
    step,
  ])

  function patchIdentity(patch: { email?: string; name?: string; back?: boolean }) {
    if (patch.back) {
      setPhase("email")
      setEmailExists(null)
      setCustomerName("")
      setIdentityError("")
      setChecking(false)
      return
    }
    if (patch.email !== undefined) {
      setEmail(patch.email)
      setIdentityError("")
      return
    }
    if (patch.name !== undefined) {
      setCustomerName(patch.name)
      setIdentityError("")
    }
  }

  /** 第一步：确认这个邮箱有没有登记过。 */
  async function checkEmail() {
    const value = email.trim()
    if (!EMAIL_PATTERN.test(value)) {
      setIdentityError("请输入有效的电子邮箱地址")
      return
    }

    setChecking(true)
    const res = await visaApi.identify({ email: value })
    setChecking(false)

    if (!res.success) {
      setIdentityError(res.message || "查询失败，请重试")
      return
    }

    setEmailExists(Boolean(res.data?.exists))
    setIdentityError("")
    setPhase("name")
  }

  /** 第二步：新邮箱设姓名，老邮箱核对姓名。 */
  async function verifyIdentity() {
    const name = customerName.trim()
    if (!name) {
      setIdentityError(emailExists ? "请输入下单时登记的姓名" : "请填写您的姓名")
      return
    }

    setChecking(true)
    const res = await visaApi.identify({ email: email.trim(), name })
    setChecking(false)
    setPhase("name")

    if (!(res.success && res.data?.ok)) {
      setIdentityError(res.message || "姓名与邮箱不匹配，请核对后重试")
      return
    }

    // 姓名核对通过才拿得到查看密钥，存本机，链接里不带
    for (const item of res.data.keys ?? []) {
      if (item.key) localStorage.setItem(`visa_order_key_${item.token}`, item.key)
    }
    localStorage.setItem("visa_owner", JSON.stringify({ email: email.trim(), name }))

    setIdentityError("")
    setVerified(true)

    if (pendingOrder && localStorage.getItem(`visa_order_key_${pendingOrder}`)) {
      navigate(`/order/${encodeURIComponent(pendingOrder.toUpperCase())}`)
      return
    }

    setHistory(res.data.orders ?? [])
    setEntering(false)
  }

  function patchPassport(index: number, patch: Partial<PassportDetails>) {
    setPassports((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    )
  }

  function changeTravelers(count: number) {
    setTravelers(count)
    setPassports((current) =>
      Array.from({ length: count }, (_, index) => current[index] ?? { ...emptyPassport }),
    )
  }

  function patchAppointment(patch: { city?: string; dates?: string[]; note?: string }) {
    if (patch.city !== undefined) setCity(patch.city)
    if (patch.dates !== undefined) setDates(patch.dates)
    if (patch.note !== undefined) setNote(patch.note)
  }

  function patchTravel(patch: { travelDate?: string; tripDays?: number }) {
    if (patch.travelDate !== undefined) setTravelDate(patch.travelDate)
    if (patch.tripDays !== undefined) setTripDays(patch.tripDays)
  }

  function changeOrigin(code: VisaOriginCode) {
    setOriginCode(code)
    const next = settings ? findDestination(settings, code, countryCode) : null
    const available = next?.centers.some((center) => center.name === city) ?? false
    if (!available) {
      setCity("")
      setDates([])
    }
  }

  function goTo(nextStep: number) {
    setStep(nextStep)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function next() {
    if (!canContinue) return
    if (step < STEPS.length - 1) {
      goTo(step + 1)
      return
    }
    submit()
  }

  function back() {
    if (step === 0) {
      navigate("/")
      return
    }
    goTo(step - 1)
  }

  // 下单接口不返回收款码，用刚存下的 view_key 再读一次
  async function loadPayCode(token: string, viewKey: string) {
    const res = await visaApi.order({ token, auth: viewKey })
    if (res.success) setPayCode(res.data?.pay_code ?? null)
  }

  async function submit() {    setSubmitting(true)
    const res = await visaApi.create({
      customer_email: email.trim(),
      customer_name: customerName.trim(),
      customer_phone: (passports[0]?.phone ?? "").trim(),
      origin_code: originCode,
      country_code: countryCode,
      travelers,
      flight,
      hotel,
      passports,
      appointment_city: city,
      appointment_dates: dates,
      appointment_note: note.trim(),
      travel_date: travelDate,
      trip_days: tripDays,
      slot_support: slotSupport,
    })
    setSubmitting(false)

    if (res.success && res.data?.order) {
      const created = res.data.order
      localStorage.removeItem(DRAFT_KEY)
      localStorage.setItem(`visa_order_key_${created.invite_token}`, res.data.view_key ?? "")
      // 刚下完单，订单页第一次打开要把收款码展开
      sessionStorage.setItem(`visa_pay_open_${created.invite_token}`, "1")
      localStorage.setItem(
        "visa_owner",
        JSON.stringify({ email: created.customer_email, name: created.customer_name }),
      )
      setOrder(created)
      window.scrollTo({ top: 0, behavior: "smooth" })
      void loadPayCode(created.invite_token, res.data.view_key ?? "")
      return
    }
    toast.error(res.message || "保存失败，请重试。")
  }

  function reset() {
    localStorage.removeItem(DRAFT_KEY)
    setStep(0)
    setEmail("")
    setCustomerName("")
    setPhase("email")
    setEmailExists(null)
    setVerified(false)
    setHistory([])
    setEntering(false)
    setIdentityError("")
    setOriginCode("CN")
    setCountryCode("")
    setTravelers(1)
    setFlight(true)
    setHotel(true)
    setPassports([{ ...emptyPassport }])
    setCity("")
    setDates([])
    setNote("")
    setSlotSupport("maybe")
    setTravelDate("")
    setTripDays(7)
    setOrder(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (!settings) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <VisaHeader className="hidden sm:block" />
        <main className="flex flex-1 items-center justify-center px-5">
          {loadFailed ? (
            <div className="text-center">
              <p className="text-sm font-medium text-ink">配置加载失败，请重试。</p>
              <button
                type="button"
                onClick={loadSettings}
                className="mt-2 text-sm font-semibold text-brand"
              >
                重新加载
              </button>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">正在加载配置…</p>
          )}
        </main>
        <VisaFooter />
      </div>
    )
  }

  if (order) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <VisaHeader className="hidden sm:block" />
        <BookingSuccess order={order} payCode={payCode} />
        <VisaFooter />
      </div>
    )
  }

  if (!verified) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-paper text-ink">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(240,214,190,0.75),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(70%_60%_at_50%_100%,rgba(226,232,214,0.6),transparent_65%)]" />

        <VisaHeader />

        <div className="pointer-events-none absolute left-1/2 top-[6%] -z-0 size-[440px] -translate-x-1/2 opacity-[0.13] blur-[4px] sm:top-1/2 sm:size-[780px] sm:-translate-y-1/2">
          <VisaMark />
        </div>

        <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
          <IdentityStep
            email={email}
            name={customerName}
            phase={phase}
            exists={emailExists}
            checking={checking}
            error={identityError}
            onChange={patchIdentity}
            onContinue={phase === "email" ? checkEmail : verifyIdentity}
          />
        </main>

        <div className="relative z-10">
          <VisaFooter />
        </div>
      </div>
    )
  }

  if (history.length > 0 && !entering) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <VisaHeader className="hidden sm:block" />
        <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:pt-10">
          <div className="rounded-[28px] border border-line bg-paper-2 p-5 shadow-[0_18px_40px_-32px_rgba(88,61,43,0.55)]">
            <p className="text-base font-extrabold text-ink">
              这个邮箱下有 {history.length} 个订单
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {customerName ? `${customerName} · ${email}` : email}
            </p>

            <div className="mt-4 space-y-2">
              {history.map((item) => (
                <Link
                  key={item.id}
                  to={`/order/${item.token.toUpperCase()}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper-3/40 px-4 py-3 transition hover:border-brand/40"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-semibold text-ink">
                      {item.country_name}
                      <span className="ml-1.5 text-[11px] font-normal text-ink-soft">
                        {item.visa}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-soft">
                      #{item.id.toUpperCase()} · {item.travel_date} · {item.trip_days} 天
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-brand">查看</span>
                </Link>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEntering(true)}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-[#fff8f1] shadow-lg shadow-brand/25 transition hover:bg-brand-deep"
              >
                再订一单
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-full px-4 py-2.5 text-xs font-semibold text-ink-soft transition hover:text-ink"
              >
                换个邮箱
              </button>
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <Link
                to="/"
                className="text-xs font-semibold text-ink-soft transition hover:text-brand"
              >
                返回首页
              </Link>
            </div>
          </div>
        </main>
        <div className="hidden sm:block">
          <VisaFooter />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <VisaHeader className="hidden sm:block" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-28 pt-5 sm:pb-20 sm:pt-8">
        <div className="flex items-center justify-between gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={back}
            className="flex items-center gap-1.5 text-ink-soft transition hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            返回
          </button>
          <p className="text-ink-soft">
            第 {step + 1} 步 / 共 {STEPS.length} 步
          </p>
          <p className="text-right text-brand">{STEPS[step]}</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eedfcc]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-[#dd8a63] transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {country && !isLastStep && (
          <div className="mt-3 flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-2xl border border-line bg-paper-2 px-3 py-2.5 shadow-[0_12px_28px_-24px_rgba(88,61,43,0.7)] sm:gap-3 sm:px-4">
            <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-ink">
              <span className="grid h-4 w-6 shrink-0 place-items-center overflow-hidden rounded-[3px] ring-1 ring-line">
                <CountryFlag code={country.code} className="size-full" />
              </span>
              {country.name}
            </span>
            <span className="hidden text-xs text-ink-soft sm:inline">{country.visa}</span>
            <span className="min-w-0 truncate text-xs text-ink-soft">
              {origin?.label}出发 · {travelers} 人
            </span>
            <span className="ml-auto flex shrink-0 items-baseline gap-1.5">
              <span className="text-[11px] text-ink-soft">总价</span>
              <span className="text-lg font-extrabold leading-none text-brand">
                {symbol}
                {quote.toPay}
              </span>
            </span>
          </div>
        )}

        <div className="mt-6">
          <div className="min-w-0">
            {step === 0 && (
              <CountryStep
                settings={settings}
                originCode={originCode}
                onOriginChange={changeOrigin}
                selectedCode={countryCode}
                onSelect={(code) => {
                  setCountryCode(code)
                  goTo(1)
                }}
              />
            )}

            {step === 1 && (
              <TravelersStep travelers={travelers} onChange={changeTravelers} />
            )}

            {step === 2 && (
              <ExtrasStep
                travelers={travelers}
                flight={flight}
                hotel={hotel}
                symbol={symbol}
                onChange={(patch) => {
                  if (patch.flight !== undefined) setFlight(patch.flight)
                  if (patch.hotel !== undefined) setHotel(patch.hotel)
                }}
              />
            )}

            {step === 3 && (
              <PassportStep
                passports={passports}
                onChange={patchPassport}
                travelerCount={travelers}
              />
            )}

            {step === 4 && (
              <AppointmentStep
                visaCenter={country?.name ?? ""}
                centers={centers}
                city={city}
                dates={dates}
                note={note}
                plan={plan}
                onChange={patchAppointment}
              />
            )}

            {step === 5 && (
              <SlotSupportStep value={slotSupport} onChange={setSlotSupport} />
            )}

            {step === 6 && (
              <TravelStep
                latestAppointment={latestAppointment}
                travelDate={travelDate}
                tripDays={tripDays}
                onChange={patchTravel}
              />
            )}

            {step === 7 && (
              <OrderSummary
                country={country}
                origin={origin}
                visaPrice={visaPrice}
                travelers={travelers}
                flight={flight}
                hotel={hotel}
                appointmentCity={city}
                appointmentDates={dates}
                appointmentNote={note.trim()}
                travelDate={travelDate}
                tripDays={tripDays}
                slotSupport={slotSupport}
              />
            )}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-5 py-2 backdrop-blur-md sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto max-w-5xl">
              {step === 3 && (!anyFilled || !phoneValid) && (
                <p className="mb-1 text-right text-[11px] font-medium text-[#a06a2c] sm:mb-2 sm:text-xs">
                  {phoneValid ? "至少填写一位出行人姓名，其余可下单后补交。" : "填写第一位出行人的手机号后继续。"}
                </p>
              )}
              {step === 4 && (!city || !dates.length) && (
                <p className="mb-1 text-right text-[11px] font-medium text-[#a06a2c] sm:mb-2 sm:text-xs">
                  选择签证中心并至少选一天递签日期。
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={back}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-paper-2 hover:text-ink sm:py-2.5"
                >
                  返回
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={!canContinue || submitting}
                  className="group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-[#fff8f1] shadow-lg shadow-brand/25 transition hover:-translate-y-0.5 hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 sm:py-3"
                >
                {submitting
                  ? "正在保存…"
                  : step === 7
                    ? "确认预订"
                    : "继续"}
                {!submitting && (
                  <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                )}
              </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="hidden sm:block">
        <VisaFooter />
      </div>
    </div>
  )
}

function BookingSuccess({ order, payCode }: { order: VisaOrderDTO; payCode: VisaPayCode | null }) {
  const [payOpen, setPayOpen] = useState(false)

  // 停留两秒再弹收款码，先把「预定成功」看清楚
  useEffect(() => {
    if (!payCode) return
    const timer = window.setTimeout(() => setPayOpen(true), 2000)
    return () => window.clearTimeout(timer)
  }, [payCode])

  const extras = [order.flight ? "机票预订单" : "", order.hotel ? "酒店预订单" : ""]
    .filter(Boolean)
    .join(" + ")
  const pendingSlots = order.passports.filter(
    (item) => !(item.first_name.trim() && item.last_name.trim()),
  ).length
  const inviteUrl = `${window.location.origin}/join/${order.invite_token.toUpperCase()}`

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl)
    toast.success("链接已复制，发给同行人即可。")
  }

  return (
    <main className="animate-in fade-in slide-in-from-bottom-2 mx-auto w-full max-w-2xl flex-1 px-5 pb-20 pt-14 text-center duration-500">
      <div className="relative mx-auto grid size-20 place-items-center">
        <span className="absolute inset-0 rounded-full bg-mint/15" />
        <span className="absolute -right-6 -top-2 text-sun">
          <Sparkles className="size-5" />
        </span>
        <span className="relative grid size-14 place-items-center rounded-full bg-mint text-[#fffaf2] shadow-lg shadow-mint/30">
          <Check className="size-7" />
        </span>
      </div>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">预订成功！</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
        前往{order.country_name}的申请已保存，签证专员将核对材料并预约递签。
      </p>

      <div className="mt-8 rounded-[28px] border border-line bg-paper-2 p-5 text-left shadow-[0_18px_40px_-32px_rgba(88,61,43,0.55)]">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="grid h-5 w-7 shrink-0 place-items-center overflow-hidden rounded-[3px] ring-1 ring-line">
              <CountryFlag code={order.country_code} className="size-full" />
            </span>
            {order.country_name}
            <span className="text-xs font-normal text-ink-soft">{order.visa}</span>
          </p>
          <p className="shrink-0 text-xs text-ink-soft">#{order.id.toUpperCase()}</p>
        </div>

        <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm text-ink">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">出发地</dt>
            <dd>{order.origin_label}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">出行人数</dt>
            <dd>{order.travelers}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-ink-soft">递签日期</dt>
            <dd className="text-right">
              {order.appointment_city} · {order.appointment_dates.join("、")}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">出行计划</dt>
            <dd className="text-right">
              {order.travel_date} · {order.trip_days} 天
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">附加服务</dt>
            <dd>{extras || "无"}</dd>
          </div>
          {order.appointment_note && (
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-ink-soft">备注</dt>
              <dd className="text-right">{order.appointment_note}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-dashed border-line pt-2 text-base">
            <dt className="font-semibold text-ink">总价</dt>
            <dd className="font-extrabold text-brand">
              {currencyOf(order.origin_code).symbol}
              {order.total}
            </dd>
          </div>
        </dl>
      </div>

      {pendingSlots > 0 && (
        <div className="mt-4 rounded-[28px] border border-line bg-paper-2 p-5 text-left shadow-[0_18px_40px_-32px_rgba(88,61,43,0.55)]">
          <p className="text-sm font-bold text-ink">邀请同行人补交护照</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            {pendingSlots} 位待补交，把链接发给本人。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="min-w-0 flex-1 rounded-full border border-line bg-paper-3/60 px-4 py-2 text-xs text-ink"
            />
            <button
              type="button"
              onClick={copyInvite}
              className="shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-[#fff8f1] transition hover:bg-brand-deep"
            >
              复制链接
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {order.passports.map((item, index) => {
              const filled = Boolean(item.first_name.trim() && item.last_name.trim())
              return (
                <span
                  key={index}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold",
                    filled ? "bg-mint/20 text-[#4f5c3f]" : "bg-[#fbe3cd] text-[#a06a2c]",
                  )}
                >
                  第 {index + 1} 位 ·{" "}
                  {filled ? `${item.last_name} ${item.first_name}`.trim() : "待填写"}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to={`/order/${order.invite_token.toUpperCase()}`}
          className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-[#fff8f1] shadow-lg shadow-brand/25 transition hover:bg-brand-deep"
        >
          查看订单状态
        </Link>
        <Link
          to="/"
          className="rounded-full border border-line bg-paper-2 px-6 py-3 text-sm font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
        >
          返回首页
        </Link>
      </div>

      {payOpen && payCode && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-[#2b1f17]/45 px-5 backdrop-blur-sm"
          onClick={() => setPayOpen(false)}
        >
          <div
            className="animate-in zoom-in-95 fade-in w-full max-w-xs rounded-[28px] border border-line bg-paper-2 p-6 text-center shadow-[0_30px_60px_-30px_rgba(88,61,43,0.7)] duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-base font-bold text-ink">扫码付款</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              请扫码支付，或长按/截图保存二维码后识别。
            </p>
            <img
              src={payCode.url}
              alt="收款二维码"
              className="mx-auto mt-4 w-44 rounded-2xl bg-white object-contain"
            />
            <p className="mt-3 text-2xl font-extrabold text-brand">
              {symbolOf(payCode.currency)}
              {payCode.pay_amount}
            </p>
            {payCode.currency !== currencyOf(order.origin_code).code && (
              <p className="mt-1 text-[11px] text-ink-soft">
                {currencyOf(order.origin_code).symbol}
                {order.total} 按汇率折算成人民币
              </p>
            )}
            <button
              type="button"
              onClick={() => setPayOpen(false)}
              className="mt-5 w-full rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-[#fff8f1] shadow-lg shadow-brand/25 transition hover:bg-brand-deep"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
