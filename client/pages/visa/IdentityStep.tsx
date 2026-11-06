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
    </div>
  )
}
