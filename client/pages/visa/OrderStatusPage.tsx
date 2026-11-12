import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { Check, Download, PencilLine, X } from "lucide-react"

import { VisaFooter, VisaHeader } from "@/client/components/visa/VisaHeader"
import { CountryFlag } from "@/client/components/visa/CountryFlag"
import { cn, toUploadImage } from "@/client/lib/utils"
import { visaApi } from "@/client/api/instance"
import { toast } from "@/client/methods/notify"
import type { VisaOrderDTO } from "@/shared/modules/visa/visa.entity"
import {
  MAX_TRAVELERS,
  VISA_SLOT_SUPPORT_OPTIONS,
  VISA_SLOT_SUPPORT_LABELS,
  normalizeSlotSupport,
  type VisaSlotSupport,
} from "@/shared/modules/visa/visa.catalog"
import { currencyOf } from "@/shared/modules/visa/visa.settings"

const STATUS_LABELS: Record<string, string> = {
  new: "待处理",
  locked: "已锁定",
  booking: "预约中",
  queued: "排号中",
  done: "已完成",
}

interface OrderForm {
  travel_date: string
  trip_days: number
  flight: boolean
  hotel: boolean
  appointment_note: string
  slot_support: VisaSlotSupport
}

const inputClass =
  "mt-1.5 h-10 w-full rounded-xl border border-line bg-paper-3/60 px-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand/50 focus:bg-paper-2 focus:outline-none focus:ring-4 focus:ring-brand/10"

export function OrderStatusPage() {
  const [params] = useSearchParams()
  const { token: pathToken } = useParams()
  const token = (pathToken ?? params.get("token") ?? "").trim().toLowerCase()
  // 查看密钥只存在本机，不放进链接，别人拿到链接也改不了
  const [orderKey, setOrderKey] = useState(() =>
    token ? localStorage.getItem(`visa_order_key_${token}`) ?? "" : "",
  )

  const [order, setOrder] = useState<VisaOrderDTO | null>(null)
  const [payCode, setPayCode] = useState<{ url: string; label: string } | null>(null)
  // 刚下单那次展开收款码，之后再进默认收起
  const [payOpen, setPayOpen] = useState(false)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadIndex, setUploadIndex] = useState(-1)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<OrderForm>({
    travel_date: "",
    trip_days: 7,
    flight: false,
    hotel: false,
    appointment_note: "",
    slot_support: "maybe",
  })

  useEffect(() => {
    let alive = true

    async function load() {
      let res = await visaApi.order({ token, auth: orderKey })

      // 本机没密钥但确认过身份，就用记下的邮箱姓名换一次，不用再走一遍确认页
      if (!res.success) {
        const saved = localStorage.getItem("visa_owner")
        if (saved) {
          try {
            const { email, name } = JSON.parse(saved) as { email: string; name: string }
            const identity = await visaApi.identify({ email, name })
            for (const item of identity.data?.keys ?? []) {
              if (item.key) localStorage.setItem(`visa_order_key_${item.token}`, item.key)
            }
            const fresh = localStorage.getItem(`visa_order_key_${token}`) ?? ""
            if (fresh) {
              if (!alive) return
              setOrderKey(fresh)
              res = await visaApi.order({ token, auth: fresh })
            }
          } catch {
            // 记下的身份失效就走确认页
          }
        }
      }

      if (!alive) return
      if (res.success && res.data?.order) {
        setOrder(res.data.order)
        setPayCode(res.data.pay_code ?? null)
        const fresh = sessionStorage.getItem(`visa_pay_open_${token}`) === "1"
        sessionStorage.removeItem(`visa_pay_open_${token}`)
        setPayOpen(fresh)
        return
      }
      setError(res.message || "未查询到相关订单")
    }

    load()
    return () => {
      alive = false
    }
  }, [token])

  if (error) {
    const needsIdentity = error.includes("确认身份")
    return (
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <VisaHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {needsIdentity ? "确认身份后查看订单" : "链接已失效或不存在"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">{error}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {needsIdentity && (
              <Link
                to={`/apply?order=${encodeURIComponent(token.toUpperCase())}`}
                className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-[#fff8f1] transition hover:bg-brand-deep"
              >
                用邮箱和姓名确认
              </Link>
            )}
            <Link
              to="/"
              className="rounded-full px-6 py-3 text-sm font-semibold text-ink-soft transition hover:text-ink"
            >
              返回首页
            </Link>
          </div>
        </main>
        <VisaFooter />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <VisaHeader />
        <main className="flex-1" />
        <VisaFooter />
      </div>
    )
  }

  const filled = order.passports.filter(
    (item) => item.first_name.trim() && item.last_name.trim(),
  ).length
  const inviteUrl = `${window.location.origin}/join/${order.invite_token.toUpperCase()}`
  const extras = [order.flight ? "机票预订单" : "", order.hotel ? "酒店预订单" : ""]
    .filter(Boolean)
    .join(" + ")
  const locked = order.status !== "new"
  const symbol = currencyOf(order.origin_code).symbol
  const canEdit = Boolean(form.travel_date.trim())

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl)
    toast.success("链接已复制。")
  }

  function pickPhoto(index: number) {
    setUploadIndex(index)
    fileRef.current?.click()
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || uploadIndex < 0) return

    setUploading(true)
    try {
      const image = await toUploadImage(file)
      const res = await visaApi.passportScan({ token, index: uploadIndex, image, auth: orderKey })
      if (res.success && res.data?.order) {
        setOrder(res.data.order)
        toast.success(
          res.data.recognized ? "已识别并更新护照信息" : "照片已收到，没认出信息，请手动补充",
        )
        return
      }
      toast.error(res.message || "上传失败，请重试")
    } finally {
      setUploading(false)
    }
  }

  async function addTraveler() {
    const res = await visaApi.addTraveler({ token, auth: orderKey })
    if (res.success && res.data?.order) {
      setOrder(res.data.order)
      toast.success("已添加一位出行人")
      return
    }
    toast.error(res.message || "添加失败")
  }

  async function removeTraveler(index: number) {
    const res = await visaApi.removeTraveler({ token, index, auth: orderKey })
    if (res.success && res.data?.order) {
      setOrder(res.data.order)
      toast.success("已删除该出行人")
      return
    }
    toast.error(res.message || "移除失败")
  }

  function startEdit() {
    if (!order) return
    setForm({
      travel_date: order.travel_date,
      trip_days: order.trip_days,
      flight: order.flight,
      hotel: order.hotel,
      appointment_note: order.appointment_note,
      slot_support: normalizeSlotSupport(order.slot_support),
    })
    setEditing(true)
  }

  async function save() {
    if (!canEdit) {
      toast.error("请填写出行日期")
      return
    }
    setSaving(true)
    const res = await visaApi.orderUpdate({
      token,
      auth: orderKey,
      travel_date: form.travel_date,
      trip_days: form.trip_days,
      flight: form.flight,
      hotel: form.hotel,
      appointment_note: form.appointment_note,
      slot_support: form.slot_support,
    })
    setSaving(false)

    if (res.success && res.data?.order) {
      setOrder(res.data.order)
      setEditing(false)
      toast.success("订单已更新")
      return
    }
    toast.error(res.message || "保存失败，请重试")
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <VisaHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">订单状态</h1>
          <span className="rounded-full bg-[#fbe3cd] px-3 py-1 text-xs font-semibold text-[#a06a2c]">
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">#{order.id.toUpperCase()}</p>

        <div className="mt-5 rounded-[28px] border border-line bg-paper-2 p-5 shadow-[0_18px_40px_-32px_rgba(88,61,43,0.55)]">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="grid h-5 w-7 shrink-0 place-items-center overflow-hidden rounded-[3px] ring-1 ring-line">
              <CountryFlag code={order.country_code} className="size-full" />
            </span>
            {order.country_name}
            <span className="text-xs font-normal text-ink-soft">{order.visa}</span>
          </p>

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
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">加急抢号</dt>
              <dd>{VISA_SLOT_SUPPORT_LABELS[order.slot_support] ?? "视号源而定"}</dd>
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
                {symbol}
                {order.total}
              </dd>
            </div>
          </dl>

          {!locked && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-2 px-4 py-2 text-xs font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
            >
              <PencilLine className="size-3.5" />
              修改订单
            </button>
          )}
          {locked && (
            <p className="mt-4 text-xs text-ink-soft">订单已锁定，需要修改请联系签证专员。</p>
          )}
        </div>

        {editing && (
          <div className="mt-4 rounded-[28px] border border-brand/30 bg-paper-2 p-5">
            <p className="text-sm font-bold text-ink">修改订单</p>
            <p className="mt-1 text-xs text-ink-soft">
              递签日期需联系签证专员调整。
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-[#6f5b4b]">出行日期</span>
                <input
                  type="text"
                  value={form.travel_date}
                  onChange={(event) => setForm({ ...form, travel_date: event.target.value })}
                  placeholder="例如：2027-03-01 或 2027年3月中旬"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#6f5b4b]">行程天数</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={form.trip_days}
                  onChange={(event) =>
                    setForm({ ...form, trip_days: Math.max(1, Number(event.target.value) || 1) })
                  }
                  className={inputClass}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { key: "flight" as const, label: "机票预订单" },
                { key: "hotel" as const, label: "酒店预订单" },
              ].map((item) => {
                const active = form[item.key]
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setForm({ ...form, [item.key]: !active })}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                      active
                        ? "border-brand bg-brand-soft/60 text-brand-deep"
                        : "border-line bg-paper-2 text-ink-soft hover:border-brand/40",
                    )}
                  >
                    {active && <Check className="size-3" />}
                    {item.label}
                  </button>
                )
              })}
            </div>

            <p className="mt-4 text-xs font-semibold text-[#6f5b4b]">加急抢号</p>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
              {VISA_SLOT_SUPPORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={form.slot_support === option.key}
                  onClick={() => setForm({ ...form, slot_support: option.key })}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition",
                    form.slot_support === option.key
                      ? "border-brand bg-brand-soft/60 text-brand-deep"
                      : "border-line bg-paper-2 text-ink-soft hover:border-brand/40",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-[#6f5b4b]">备注</span>
              <textarea
                value={form.appointment_note}
                maxLength={300}
                rows={3}
                onChange={(event) => setForm({ ...form, appointment_note: event.target.value })}
                className="mt-1.5 w-full resize-none rounded-xl border border-line bg-paper-3/60 px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand/50 focus:bg-paper-2 focus:outline-none focus:ring-4 focus:ring-brand/10"
              />
            </label>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-full bg-brand px-5 py-2 text-xs font-semibold text-[#fff8f1] transition hover:bg-brand-deep disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存修改"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-ink-soft transition hover:text-ink"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {order.status === "new" && (
          <div className="mt-4 rounded-[28px] border border-line bg-paper-2 p-5 shadow-[0_18px_40px_-32px_rgba(88,61,43,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-ink">扫码付款</p>
                <p className="mt-1 text-xs text-ink-soft">
                  应付 {symbol}
                  {order.total}
                </p>
              </div>
              {payCode && (
                <button
                  type="button"
                  onClick={() => setPayOpen((open) => !open)}
                  className="shrink-0 text-xs font-semibold text-brand"
                >
                  {payOpen ? "收起" : "展开"}
                </button>
              )}
            </div>

            {!payCode ? (
              <p className="mt-3 text-xs text-ink-soft">
                线上支付通道维护中，签证专员将联系您协助完成支付。
              </p>
            ) : (
              <>
                {payOpen && (
                  <div className="mt-3 flex flex-col items-center">
                    <img
                      src={payCode.url}
                      alt="微信支付二维码"
                      className="size-52 rounded-2xl bg-white p-2 ring-1 ring-line"
                    />
                    {payCode.label && (
                      <p className="mt-2 text-xs font-semibold text-ink">{payCode.label}</p>
                    )}
                  </div>
                )}
                <p className="mt-3 text-xs text-ink-soft">
                  如已支付，系统正在核验入账，请稍候。
                </p>
              </>
            )}
          </div>
        )}

        <div className="mt-4 rounded-[28px] border border-line bg-paper-2 p-5 shadow-[0_18px_40px_-32px_rgba(88,61,43,0.55)]">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-ink">护照信息</p>
            <p className="text-xs text-ink-soft">
              {filled}/{order.travelers} 已填写
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eedfcc]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-[#dd8a63] transition-all duration-500"
              style={{ width: `${(filled / order.travelers) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {order.passports.map((item, index) => {
              const done = Boolean(item.first_name.trim() && item.last_name.trim())
              const removable = !locked && order.travelers > 1
              return (
                <span
                  key={index}
                  className={cn(
                    "flex w-full items-center gap-1 rounded-full py-1.5 pl-3 text-[11px] font-semibold transition",
                    done ? "bg-mint/15 text-[#4f5c3f]" : "bg-[#fbe3cd] text-[#a06a2c]",
                    removable ? "pr-1.5" : "pr-3",
                  )}
                >
                  <button
                    type="button"
                    disabled={locked || uploading}
                    onClick={() => pickPhoto(index)}
                    className={cn(
                      "flex flex-1 items-center gap-1 text-left",
                      !locked && "hover:opacity-80",
                    )}
                  >
                    {done && <Check className="size-3 shrink-0" />}
                    第 {index + 1} 位 ·{" "}
                    {done ? `${item.last_name} ${item.first_name}`.trim() : "待填写"}
                  </button>
                  {removable && (
                    <button
                      type="button"
                      onClick={() => removeTraveler(index)}
                      title="删除该出行人"
                      aria-label={`删除第 ${index + 1} 位出行人`}
                      className="grid size-4 shrink-0 place-items-center rounded-full transition hover:bg-black/10"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              )
            })}
          </div>

          {locked ? (
            <p className="mt-3 text-xs text-ink-soft">订单已锁定，无法重新上传护照。</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-ink-soft">
                {uploading ? "正在识别…" : "点击任意出行人，可修改或重新上传护照。"}
              </span>
              {order.travelers < MAX_TRAVELERS && (
                <button
                  type="button"
                  onClick={addTraveler}
                  className="rounded-full border border-line px-3 py-1 font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
                >
                  + 添加同行人
                </button>
              )}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={uploadPhoto}
          />

          <div className="mt-3 space-y-2">
            {order.passports.map((item, index) => {
              if (!(item.first_name.trim() && item.last_name.trim())) return null
              const rows: [string, string][] = [
                ["姓", item.last_name],
                ["名", item.first_name],
                ["出生日期", item.birth_date],
                ["性别", item.gender],
                ["国籍", item.nationality],
                ["出生地", item.birth_place],
                ["护照号", item.passport_number],
                ["签发日期", item.issue_date],
                ["有效期至", item.expiry_date],
              ]
              return (
                <details
                  key={index}
                  className="rounded-2xl border border-line bg-paper-3/40 px-3 py-2"
                >
                  <summary className="cursor-pointer text-xs font-semibold text-ink">
                    第 {index + 1} 位护照信息
                  </summary>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    {rows.map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-ink-soft">{label}</dt>
                        <dd className="truncate text-ink">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )
            })}
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <p className="text-xs text-ink-soft">发送链接给同行人，对方可直接补交护照信息。</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
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
          </div>
        </div>

        {order.status !== "new" && (
          <div className="mt-4 rounded-[28px] border border-line bg-paper-2 p-5 shadow-[0_18px_40px_-32px_rgba(88,61,43,0.55)]">
            <p className="text-sm font-bold text-ink">预约进度</p>
            <div className="mt-3 flex justify-between gap-3 text-sm">
              <span className="text-ink-soft">已约递签时间</span>
              <span className="text-right">{order.position || "待安排"}</span>
            </div>

            <p className="mt-4 text-xs font-semibold text-[#6f5b4b]">可下载文件</p>
            {order.files.length ? (
              <ul className="mt-2 space-y-2">
                {order.files.map((file) => (
                  <li key={file.id}>
                    <a
                      href={`/api/visa/file?id=${file.id}`}
                      download={file.name}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper-3/40 px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand/40"
                    >
                      <span className="truncate">{file.name}</span>
                      <Download className="size-3.5 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-ink-soft">暂无可下载文件。</p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/apply?list=1"
            className="rounded-full border border-line bg-paper-2 px-6 py-3 text-center text-sm font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
          >
            返回订单列表
          </Link>
          <Link
            to="/"
            className="rounded-full border border-line bg-paper-2 px-6 py-3 text-center text-sm font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
          >
            返回首页
          </Link>
        </div>
      </main>
      <VisaFooter />
    </div>
  )
}
