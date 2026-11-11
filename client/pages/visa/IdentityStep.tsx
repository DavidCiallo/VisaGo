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
              placeholder="您的联系邮箱"
              className="h-12 w-full rounded-full border border-line bg-paper-3/70 px-5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand/50 focus:bg-paper-2 focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
          )}

          {askingName && (
            <input
              value={name}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder={exists ? "请输入登记的姓名" : "设置姓名（中文）"}
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
          隐私协议
        </button>
      </p>

      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>隐私协议</DialogTitle>
            <DialogDescription>更新日期：2026 年 11 月 11 日</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm leading-relaxed text-ink">
            <PolicySection title="一、我们收集哪些信息">
              <ul className="list-disc space-y-1 pl-5">
                <li>联系信息：邮箱、姓名。</li>
                <li>
                  护照信息：护照首页识别后得到的姓名、护照号、出生日期、性别、国籍、出生地、签发日期、有效期。
                </li>
                <li>
                  订单信息：出发地、目的地、出行人数、递签城市与递签日期、计划出行日期与天数、附加服务，以及您填写的备注。
                </li>
              </ul>
            </PolicySection>

            <PolicySection title="二、关于护照照片">
              护照首页照片仅用于当次文字识别，识别完成后即丢弃，不保存、不留副本。系统中只保留识别出的文字信息。
            </PolicySection>

            <PolicySection title="三、信息用途">
              <ul className="list-disc space-y-1 pl-5">
                <li>核对身份，查找并展示您的订单。</li>
                <li>准备申请材料，代为预约递签。</li>
                <li>就预约进度与签证中心或使领馆沟通。</li>
                <li>在必要时通过邮箱与您联系。</li>
              </ul>
            </PolicySection>

            <PolicySection title="四、支付">
              页面展示的收款码由我们提供，您在微信或支付宝内自行完成支付。我们不收集您的银行卡号、支付账户或支付密码。
            </PolicySection>

            <PolicySection title="五、第三方">
              <ul className="list-disc space-y-1 pl-5">
                <li>阿里云文字识别服务：仅将您上传的图片用于文字识别。</li>
                <li>签证中心及使领馆：为预约递签，需按对方要求提交申请材料。</li>
              </ul>
              除上述情形以及法律法规要求外，我们不会向第三方提供您的个人信息。
            </PolicySection>

            <PolicySection title="六、保存期限">
              订单办理完成后，或您要求删除时，我们删除相应的个人信息；法律法规另有保存要求的除外。
            </PolicySection>

            <PolicySection title="七、您的权利">
              您可以查询、更正、复制、删除您的个人信息，也可以撤回同意。如需行使上述权利，请通过网站下方的联系方式与我们联系，我们将在十五个工作日内答复。
            </PolicySection>

            <PolicySection title="八、信息安全">
              我们采取访问控制、传输加密、定期备份等措施保护您的信息。发生可能影响您权益的安全事件时，我们会及时告知。
            </PolicySection>

            <PolicySection title="九、未成年人">
              本服务面向成年人。未满十八周岁的申请人，请由监护人代为办理并同意本协议。
            </PolicySection>

            <PolicySection title="十、协议更新">
              协议变更时，我们会在本页面更新并标注日期。继续使用本服务视为接受更新后的协议。
            </PolicySection>

            <PolicySection title="十一、联系我们">
              如需咨询或行使上述权利，请通过 noworrytourism.cn 上的联系方式与我们联系。
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
