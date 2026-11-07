import { Link } from "react-router-dom"
import { ArrowRight, CalendarClock, FileCheck2, Plane, ScanLine } from "lucide-react"

import { VisaFooter, VisaHeader } from "@/client/components/visa/VisaHeader"

const features = [
  {
    icon: ScanLine,
    title: "护照扫描",
    desc: "识别护照首页，自动填表。",
  },
  {
    icon: FileCheck2,
    title: "附加材料",
    desc: "机票与酒店预订单随申请一并准备。",
  },
  {
    icon: CalendarClock,
    title: "递签日期",
    desc: "按中心档期多选，由我们协调。",
  },
]

export function VisaLandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-paper text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-44 left-1/2 size-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#f1d3bf,transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-28 top-72 size-80 rounded-full bg-[radial-gradient(circle,#e3e6cd,transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-24 size-72 rounded-full bg-[radial-gradient(circle,#f7e4c4,transparent_65%)]"
      />

      <VisaHeader />

      <main className="relative mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-16 text-center sm:pt-20">
        <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
          今天开始您的签证申请
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-ink-soft sm:text-lg">
          材料准备与递签预约，我们一次办妥。
        </p>

        <Link
          to="/apply?new=1"
          className="group mt-9 inline-flex items-center gap-2.5 rounded-full bg-brand px-8 py-4 text-base font-semibold text-[#fff8f1] shadow-xl shadow-brand/25 transition hover:-translate-y-0.5 hover:bg-brand-deep"
        >
          <Plane className="size-4 -rotate-12" />
          开始申请
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
        <p className="mt-4 text-xs text-ink-soft/80">
          约不到递签时间全额退款
        </p>

        <div className="mt-14 overflow-hidden rounded-[28px] border border-line bg-paper-2 p-4 text-left shadow-[0_18px_40px_-32px_rgba(88,61,43,0.5)] sm:flex sm:items-center sm:gap-5 sm:p-5">
          <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-2xl sm:size-24">
            <MiniScene />
          </div>
          <div className="mt-4 flex-1 sm:mt-0">
            <h2 className="font-bold text-ink">出发日期未定？</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              先选国家与递签日期，护照信息稍后补交。
            </p>
          </div>
          <Link
            to="/apply?new=1"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-deep transition hover:bg-brand/15 sm:mt-0"
          >
            开始填写
          </Link>
        </div>

        <ul className="mt-10 grid gap-3 text-left sm:grid-cols-3">
          {features.map((feature) => (
            <li
              key={feature.title}
              className="rounded-2xl border border-line bg-paper-2/80 p-4 shadow-[0_12px_30px_-26px_rgba(88,61,43,0.5)]"
            >
              <feature.icon className="size-5 text-brand" />
              <p className="mt-3 text-sm font-semibold text-ink">{feature.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{feature.desc}</p>
            </li>
          ))}
        </ul>
      </main>

      <VisaFooter />
    </div>
  )
}

function MiniScene() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#f3c9a8] via-[#dc9c74] to-[#a8734e]">
      <div className="absolute -right-4 -top-5 size-16 rounded-full bg-[#fff4dc]" />
      <div className="absolute -left-6 bottom-0 h-2/3 w-3/4 rounded-t-[100%] bg-[#9c6a4c]/70" />
      <div className="absolute -right-8 bottom-0 h-1/2 w-2/3 rounded-t-[100%] bg-[#7a8b5f]/80" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#3a2c25]/30 to-transparent" />
    </div>
  )
}
