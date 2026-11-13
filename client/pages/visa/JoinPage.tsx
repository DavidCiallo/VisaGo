import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { Check, PencilLine, Trash2, UserRoundPlus } from "lucide-react"

import { VisaFooter, VisaHeader } from "@/client/components/visa/VisaHeader"
import { cn } from "@/client/lib/utils"
import { visaApi } from "@/client/api/instance"
import { toast } from "@/client/methods/notify"
import type { PassportDetails } from "@/shared/modules/visa/visa.entity"
import type { VisaInviteResponse } from "@/shared/modules/visa/visa.interface"
import { PassportStep } from "./PassportStep"

type InviteOrder = NonNullable<VisaInviteResponse["data"]>["order"]

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

/** 谁填的哪一位只记在本机，换浏览器就查不到、也改不了。 */
function readKeys(token: string, travelers: number) {
  const keys: { index: number; key: string }[] = []
  for (let index = 0; index < travelers; index += 1) {
    const key = localStorage.getItem(`visa_slot_key_${token}_${index}`)
    if (key) keys.push({ index, key })
  }
  return keys
}

export function JoinPage() {
  const [params] = useSearchParams()
  const { token: pathToken } = useParams()
  const token = (pathToken ?? params.get("token") ?? "").trim().toLowerCase()

  const [order, setOrder] = useState<InviteOrder | null>(null)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<{ index: number; passport: PassportDetails } | null>(null)
  const [passport, setPassport] = useState<PassportDetails>({ ...emptyPassport })
  const [submitting, setSubmitting] = useState(false)

  async function load(travelers = order?.travelers ?? 0) {
    const res = await visaApi.invite({ token, slot_keys: readKeys(token, travelers) })
    if (res.success && res.data?.order) {
      setOrder(res.data.order)
      return
    }
    setError(res.message || "邀请链接已失效，请联系订单发起人重新获取")
  }

  useEffect(() => {
    let alive = true
    visaApi.invite({ token, slot_keys: readKeys(token, 5) }).then((res) => {
      if (!alive) return
      if (res.success && res.data?.order) {
        setOrder(res.data.order)
        return
      }
      setError(res.message || "邀请链接已失效，请联系订单发起人重新获取")
    })
    return () => {
      alive = false
    }
  }, [token])

  function changePassport(_slot: number, patch: Partial<PassportDetails>) {
    setPassport((current) => ({ ...current, ...patch }))
  }

  function startFill(index: number, current?: PassportDetails) {
    setEditing({ index, passport: current ?? { ...emptyPassport } })
    setPassport(current ?? { ...emptyPassport })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function submit() {
    if (!editing) return
    if (!passport.first_name.trim() || !passport.last_name.trim()) {
      toast.error("请填写姓和名")
      return
    }

    setSubmitting(true)
    const res = await visaApi.inviteSubmit({
      token,
      index: editing.index,
      passport,
      slot_key: localStorage.getItem(`visa_slot_key_${token}_${editing.index}`) ?? "",
    })
    setSubmitting(false)

    if (res.success) {
      if (res.data?.slot_key) {
        localStorage.setItem(`visa_slot_key_${token}_${editing.index}`, res.data.slot_key)
      }
      toast.success(editing.passport.last_name ? "已更新" : "已保存")
      setEditing(null)
      setPassport({ ...emptyPassport })
      await load(order?.travelers ?? 0)
      return
    }
    toast.error(res.message || "提交失败，请重试")
  }

  async function remove(index: number) {
    const res = await visaApi.inviteSlotRemove({
      token,
      index,
      slot_key: localStorage.getItem(`visa_slot_key_${token}_${index}`) ?? "",
    })
    if (res.success) {
      localStorage.removeItem(`visa_slot_key_${token}_${index}`)
      toast.success("已删除")
      await load(order?.travelers ?? 0)
      return
    }
    toast.error(res.message || "删除失败")
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <VisaHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">链接已失效或不存在</h1>
          <p className="mt-2 text-sm text-ink-soft">{error}</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-[#fff8f1] transition hover:bg-brand-deep"
          >
            返回首页
          </Link>
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

  const mine = order.slots.filter((slot) => slot.mine)

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <VisaHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:pt-10">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {editing ? "填写护照信息" : "同行人护照"}
        </h1>

        <div className="mt-6 rounded-[28px] border border-line bg-paper-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">
              {order.country_name}
              <span className="ml-2 text-xs font-normal text-ink-soft">{order.visa}</span>
            </p>
            <p className="text-xs text-ink-soft">#{order.id.toUpperCase()}</p>
          </div>
          <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-ink-soft">递签</dt>
              <dd className="text-right">
                {order.appointment_city} · {order.appointment_dates.join("、")}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">出行</dt>
              <dd className="text-right">
                {order.travel_date} · {order.trip_days} 天
              </dd>
            </div>
          </dl>
        </div>

        {editing ? (
          <>
            <div className="mt-5">
              <PassportStep
                passports={[passport]}
                travelerCount={1}
                onChange={changePassport}
              />
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setPassport({ ...emptyPassport })
                }}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:text-ink"
              >
                返回
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-[#fff8f1] shadow-lg shadow-brand/25 transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "提交中…" : "保存信息"}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-5 space-y-2">
            {order.slots.map((slot) => (
              <div
                key={slot.index}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    {slot.filled ? (
                      <Check className="size-3.5 text-mint" />
                    ) : (
                      <UserRoundPlus className="size-3.5 text-ink-soft" />
                    )}
                    第 {slot.index + 1} 位
                    <span className="ml-1 font-normal text-ink-soft">
                      {slot.filled ? slot.name : "待填写"}
                    </span>
                  </p>
                  {slot.mine && (
                    <p className="mt-0.5 text-[11px] text-ink-soft">由您本机填写</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!slot.filled && (
                    <button
                      type="button"
                      onClick={() => startFill(slot.index)}
                      className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-[#fff8f1] transition hover:bg-brand-deep"
                    >
                      填写
                    </button>
                  )}
                  {slot.filled && slot.mine && (
                    <>
                      <button
                        type="button"
                        onClick={() => startFill(slot.index, slot.passport)}
                        className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
                      >
                        <PencilLine className="size-3" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(slot.index)}
                        className={cn(
                          "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                          "text-[#a06a2c] hover:bg-[#fbe3cd]/60",
                        )}
                      >
                        <Trash2 className="size-3" />
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {mine.length > 0 && (
              <p className="pt-1 text-[11px] leading-snug text-ink-soft">
                为保护隐私，更换设备或浏览器后将隐藏您已填的信息。
              </p>
            )}
          </div>
        )}
      </main>
      <VisaFooter />
    </div>
  )
}
