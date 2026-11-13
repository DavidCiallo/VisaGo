import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { Camera, Check, CheckCircle2, Info, ScanLine } from "lucide-react"

import { visaApi } from "@/client/api/instance"
import { cn, toUploadImage } from "@/client/lib/utils"
import { toast } from "@/client/methods/notify"
import type { PassportDetails } from "@/shared/modules/visa/visa.entity"
import { StepCard } from "./StepCard"

type Mode = "intro" | "scanning" | "form"

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-paper-3/60 px-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand/50 focus:bg-paper-2 focus:outline-none focus:ring-4 focus:ring-brand/10"

const amberBox =
  "flex gap-2 rounded-2xl border border-[#ecd2a4] bg-[#fdf3e0] p-3.5 text-sm leading-relaxed text-[#7b5a30]"

function filled(passport: PassportDetails | undefined) {
  return Boolean(passport?.first_name.trim() && passport?.last_name.trim())
}

export function PassportStep({
  passports,
  travelerCount,
  phone,
  onChange,
  onPhoneChange,
}: {
  passports: PassportDetails[]
  travelerCount: number
  /** 邀请页不给联系方式，传了才显示这一行 */
  phone?: string
  onChange: (index: number, patch: Partial<PassportDetails>) => void
  onPhoneChange?: (value: string) => void
}) {
  const [active, setActive] = useState(0)
  const [mode, setMode] = useState<Mode>("intro")
  const [preview, setPreview] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const timer = useRef<number | null>(null)
  const opened = useRef(false)

  const passport = passports[active] ?? passports[0]
  const done = passports.filter(filled).length

  useEffect(() => {
    if (opened.current || !filled(passports[active])) return
    opened.current = true
    setMode("form")
  }, [passports, active])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function selectTraveler(index: number) {
    setActive(index)
    setPreview(null)
    setScanned(false)
    setMode(filled(passports[index]) ? "form" : "intro")
  }

  function applyFields(passport: PassportDetails) {
    const patch: Partial<PassportDetails> = {}
    for (const [key, value] of Object.entries(passport)) {
      if (String(value).trim()) patch[key as keyof PassportDetails] = String(value)
    }
    onChange(active, patch)
    setScanned(true)
    setMode("form")
    return Object.keys(patch).length
  }

  async function recognize(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片格式的护照首页")
      setMode("intro")
      return
    }

    try {
      const image = await toUploadImage(file)
      const res = await visaApi.ocrPassport({ image })
      const fields = res.data?.passport
      if (!res.success || !fields) {
        toast.error(res.message || "护照识别暂时不可用，请手动填写")
        setMode("form")
        return
      }

      const count = applyFields(fields)
      if (count === 0) {
        toast("没认出护照信息，请手动填写", "info")
      } else if (!fields.passport_number.trim() || !fields.birth_date.trim()) {
        toast("已填入能认出的信息，其余请补充", "info")
      }
    } catch {
      toast.error("护照照片没传成功，可以重试，也可以手动填写")
      setMode("form")
    }
  }

  function scan(file: File) {
    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file))
    }
    setMode("scanning")
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void recognize(file), 200)
  }

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) scan(file)
    event.target.value = ""
  }

  function edit(patch: Partial<PassportDetails>) {
    onChange(active, patch)
  }

  return (
    <StepCard
      icon={ScanLine}
      title="护照信息"
      subtitle={travelerCount > 1 ? `${travelerCount} 位出行人各填一份。` : "上传护照照片，自动识别信息"}
    >
      {travelerCount > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#6f5b4b]">出行人</span>
          {passports.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => selectTraveler(index)}
              aria-label={`第 ${index + 1} 位出行人的护照`}
              aria-pressed={index === active}
              className={cn(
                "grid size-8 place-items-center rounded-full border text-sm font-bold transition",
                index === active
                  ? "border-brand bg-brand text-[#fff8f1]"
                  : filled(item)
                    ? "border-mint/60 bg-mint/15 text-[#4f5c3f]"
                    : "border-line bg-paper-2 text-ink-soft hover:border-brand/40",
              )}
            >
              {filled(item) ? <Check className="size-4" /> : index + 1}
            </button>
          ))}
          <span className="text-[11px] text-ink-soft/80">
            已完成 {done}/{travelerCount}
          </span>
        </div>
      )}

      {mode === "intro" && (
        <>
          <div className={amberBox}>
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>请上传带个人照片与护照号的信息页</span>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") fileInput.current?.click()
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const file = event.dataTransfer.files?.[0]
              if (file) scan(file)
            }}
            className="group mt-4 cursor-pointer rounded-[24px] border-2 border-dashed border-brand/35 bg-brand-soft/50 p-6 text-center transition hover:border-brand/60 hover:bg-brand-soft/80"
          >
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand text-[#fff8f1] shadow-lg shadow-brand/25 transition group-hover:-translate-y-0.5">
              <Camera className="size-7" />
            </span>
            <p className="mt-3 text-base font-bold text-ink">
              {travelerCount > 1 ? `上传第 ${active + 1} 位出行人的护照` : "扫描护照"}
            </p>
            <p className="mt-1 text-sm text-ink-soft">点击或拖入照片</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pick}
          />
        </>
      )}

      {mode === "scanning" && (
        <div className="rounded-[20px] border border-line bg-paper-3/50 p-4">
          <div className="relative mx-auto h-44 w-full max-w-sm overflow-hidden rounded-xl bg-paper-2 ring-1 ring-line">
            {preview ? (
              <img src={preview} alt="护照预览" className="size-full object-cover" />
            ) : (
              <div className="space-y-2.5 p-5">
                <div className="h-2 w-2/3 rounded-full bg-line" />
                <div className="h-2 w-1/2 rounded-full bg-line" />
                <div className="h-2 w-3/4 rounded-full bg-line" />
                <div className="h-2 w-2/5 rounded-full bg-line" />
              </div>
            )}
            <div className="visa-scanline absolute inset-x-0 top-0 h-0.5 bg-brand shadow-[0_0_14px_3px_rgba(194,91,63,0.45)]" />
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-ink">正在识别…</p>
        </div>
      )}

      {mode === "form" && (
        <div className="animate-in fade-in duration-300">
          {scanned && (
            <div className="flex gap-2 rounded-2xl border border-mint/30 bg-mint/10 p-3.5 text-sm text-[#4f5c3f]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                请以护照原件核对，有误可直接修改。
              </span>
            </div>
          )}
          {!scanned && (
            <div className={amberBox}>
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>护照号和日期可以之后再补。</span>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="姓">
              <input
                className={inputClass}
                value={passport.last_name}
                onChange={(event) => edit({ last_name: event.target.value })}
                placeholder="ZHANG"
              />
            </Field>
            <Field label="名">
              <input
                className={inputClass}
                value={passport.first_name}
                onChange={(event) => edit({ first_name: event.target.value })}
                placeholder="WEI"
              />
            </Field>
            <Field label="出生日期">
              <input
                type="date"
                className={inputClass}
                value={passport.birth_date}
                onChange={(event) => edit({ birth_date: event.target.value })}
              />
            </Field>
            <Field label="性别">
              <select
                className={inputClass}
                value={passport.gender}
                onChange={(event) => edit({ gender: event.target.value })}
              >
                <option value="">请选择</option>
                <option value="女">女 Female</option>
                <option value="男">男 Male</option>
                <option value="其他">其他 Other</option>
              </select>
            </Field>
            <Field label="国籍">
              <input
                className={inputClass}
                value={passport.nationality}
                onChange={(event) => edit({ nationality: event.target.value })}
                placeholder="中国"
              />
            </Field>
            <Field label="出生城市">
              <input
                className={inputClass}
                value={passport.birth_place}
                onChange={(event) => edit({ birth_place: event.target.value })}
                placeholder="杭州"
              />
            </Field>
          </div>

          <div className="mt-5 border-t border-line pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <p className="text-xs font-semibold text-[#6f5b4b]">护照号码与日期</p>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field label="护照号码">
                <input
                  className={inputClass}
                  value={passport.passport_number}
                  onChange={(event) => edit({ passport_number: event.target.value })}
                  placeholder="E12345678"
                />
              </Field>
              <Field label="签发日期">
                <input
                  type="date"
                  className={inputClass}
                  value={passport.issue_date}
                  onChange={(event) => edit({ issue_date: event.target.value })}
                />
              </Field>
              <Field label="有效期至">
                <input
                  type="date"
                  className={inputClass}
                  value={passport.expiry_date}
                  onChange={(event) => edit({ expiry_date: event.target.value })}
                />
              </Field>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMode("intro")}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand"
          >
            <ScanLine className="size-3.5" />
            重新扫描
          </button>

          {travelerCount > 1 && (
            <p className="mt-3 text-xs text-ink-soft/70">
              其余信息可下单后补齐。
            </p>
          )}
        </div>
      )}

      {onPhoneChange && (
        <div className="mt-6 grid gap-1.5 border-t border-line/70 pt-4">
          <span className="text-xs font-semibold text-ink-soft">手机号</span>
          <input
            type="tel"
            inputMode="tel"
            className={inputClass}
            value={phone ?? ""}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="例如 13800138000"
          />
        </div>
      )}
    </StepCard>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#6f5b4b]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-ink-soft/70">{hint}</span>}
    </label>
  )
}
