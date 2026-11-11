import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog"

/** 斜放的护照、签证章和登机牌，全部直线折角。 */
export function VisaMark() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="size-full">
      <circle cx="60" cy="60" r="58" fill="#fbeadb" />

      {/* 登机牌 */}
      <g transform="rotate(-10 34 88)">
        <path d="M10 78h50v20H10z" fill="#fdf2e0" />
        <path d="M10 78h50v20H10z" fill="none" stroke="#e5d3ba" strokeWidth="1.4" />
        <path d="M46 78v20" stroke="#e5d3ba" strokeWidth="1.4" strokeDasharray="3 3" />
        <path d="M16 84h24M16 90h18" stroke="#d8c0a2" strokeWidth="2" strokeLinecap="round" />
        <path d="M52 84h4M52 92h4" stroke="#c96a4a" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* 护照 */}
      <g transform="rotate(-14 62 58)">
        <path d="M38 28h48v62H38z" fill="#a9513a" />
        <path d="M42 32h40v54H42z" fill="none" stroke="#c96a4a" strokeWidth="1.6" />
        <circle cx="62" cy="52" r="10" fill="none" stroke="#e5c08e" strokeWidth="2" />
        <path d="M62 43v18M54 52h16" stroke="#e5c08e" strokeWidth="1.6" />
        <path d="M52 70h20M55 76h14" stroke="#e5c08e" strokeWidth="2.4" strokeLinecap="round" />
      </g>

      {/* 签证章 */}
      <g transform="rotate(12 88 30)">
        <circle cx="88" cy="30" r="15" fill="none" stroke="#c96a4a" strokeWidth="2.4" strokeDasharray="4 3" />
        <path
          d="M81 30l5 5 9-10"
          fill="none"
          stroke="#c96a4a"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

export function IdentityStep({
  email,
  name,
  phase,
  exists,
  checking,
  error,
  onChange,
  onContinue,
}: {
  email: string
  name: string
  phase: "email" | "name"
  exists: boolean | null
  checking: boolean
  error: string
  onChange: (patch: { email?: string; name?: string; back?: boolean }) => void
  onContinue: () => void
}) {
  const askingName = phase === "name"
  const [policyOpen, setPolicyOpen] = useState(false)

  return (
    <div className="relative w-full max-w-md">
      <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[48px] bg-[radial-gradient(60%_60%_at_50%_30%,rgba(233,193,160,0.45),transparent_70%)]" />

      <div className="rounded-[32px] border border-line bg-paper-2/95 p-7 shadow-[0_28px_60px_-42px_rgba(88,61,43,0.65)] backdrop-blur-sm sm:p-8">
        <div className="mx-auto size-28 overflow-hidden rounded-full shadow-inner ring-1 ring-white/70">
          <VisaMark />
        </div>

        <h1 className="mt-5 text-center text-2xl font-extrabold tracking-tight text-ink">
          签证申请
        </h1>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onContinue()
          }}
          className="mt-6 space-y-3"
        >
          {askingName ? (
            <div className="flex h-12 items-center gap-3 rounded-full border border-line bg-paper-3/50 px-5">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{email}</span>
              <button
                type="button"
                onClick={() => onChange({ back: true })}
                className="shrink-0 text-xs font-semibold text-brand"
              >
                修改
              </button>
            </div>
          ) : (
            <input
              type="email"
              value={email}
              onChange={(event) => onChange({ email: event.target.value })}
              placeholder="邮箱"
              className="h-12 w-full rounded-full border border-line bg-paper-3/70 px-5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand/50 focus:bg-paper-2 focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
          )}

          {askingName && (
            <input
              value={name}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder={exists ? "登记过的姓名" : "姓名（中文）"}
              maxLength={20}
              className="h-12 w-full rounded-full border border-line bg-paper-3/70 px-5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand/50 focus:bg-paper-2 focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
          )}

          {error && (
            <p className="pl-5 text-[11px] font-medium text-brand-deep">{error}</p>
          )}

          <button
            type="submit"
            disabled={checking}
            className="h-12 w-full rounded-full bg-gradient-to-b from-brand to-brand-deep text-sm font-semibold text-[#fff8f1] shadow-lg shadow-brand/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? "查询中…" : "继续"}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-soft/80">
        使用本服务，您已阅读并同意我们的
        <button
          type="button"
          onClick={() => setPolicyOpen(true)}
          className="underline decoration-ink-soft/50 underline-offset-2 transition hover:text-brand"
        >
          隐私保护政策
        </button>
      </p>

      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>隐私保护政策</DialogTitle>
            <DialogDescription>更新日期：2026年11月11日</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm leading-relaxed text-ink">
            <PolicySection title="一、 信息收集范围">
              <p>为向您提供签证预约及材料辅助服务，我们仅收集履行服务所必需的信息：</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>基础联系信息：您的姓名及电子邮箱。</li>
                <li>
                  证件识别信息：通过光学字符识别（OCR）提取的护照首页文本信息，包括姓名、护照号码、出生日期、性别、国籍、出生地、签发日期及有效期。
                </li>
                <li>
                  行程与订单信息：出发地、目的地、出行人数、递签城市与日期、计划出行时间、所选附加服务及订单备注。
                </li>
              </ul>
            </PolicySection>

            <PolicySection title="二、 证件影像安全承诺">
              您上传的护照首页照片仅用于当次实时信息提取。识别完成后，原始图片将立即从内存及服务器中自动销毁，系统不保存、不留存任何影像副本，仅保留提取后的必要文本数据。
            </PolicySection>

            <PolicySection title="三、 信息使用目的">
              <p>我们收集的上述信息仅用于以下明确用途：</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>核验客户身份，查询及展示订单状态；</li>
                <li>辅助生成签证申请材料，并代为完成递签预约；</li>
                <li>就预约及办理进度与相关签证中心或使领馆进行必要沟通；</li>
                <li>在服务关键节点或异常情况下，通过电子邮箱与您取得联系。</li>
              </ul>
            </PolicySection>

            <PolicySection title="四、 支付与交易安全">
              本平台通过微信支付、支付宝等官方合规渠道完成订单结算。支付过程由您在对应支付平台内独立完成，我们不会收集、接触或存储您的银行卡号、支付账户及支付密码等敏感金融信息。
            </PolicySection>

            <PolicySection title="五、 信息共享与第三方服务">
              <p>除以下必要场景及法律法规要求外，我们绝不会向任何第三方出售、出租或共享您的个人信息：</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  技术服务商：为实现证件自动录入，图片数据将通过加密通道传输至具备安全资质的云服务商（阿里云）仅作实时文字识别处理。
                </li>
                <li>
                  官方机构：为完成递签预约，我们需按相关签证中心及使领馆的官方要求，代您提交必要的申请材料。
                </li>
              </ul>
            </PolicySection>

            <PolicySection title="六、 数据存储与删除">
              您的数据仅在订单办理期间予以加密保存。当订单服务完结，或您主动提出删除申请时，我们将立即从系统中永久清除您的相关个人信息（法律法规另有强制留存要求的除外）。
            </PolicySection>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold text-ink">{title}</h3>
      <div className="mt-1 text-ink-soft">{children}</div>
    </section>
  )
}
