import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Archive, RefreshCw, Search, Upload } from "lucide-react"

import { Badge } from "@/client/components/ui/badge"
import { Button } from "@/client/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card"
import { Input } from "@/client/components/ui/input"
import { Textarea } from "@/client/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table"
import { visaApi } from "@/client/api/instance"
import { cn, formatDates } from "@/client/lib/utils"
import { getAuth } from "@/client/methods/auth"
import { toast } from "@/client/methods/notify"
import { VISA_COUNTRIES, VISA_SLOT_SUPPORT_LABELS } from "@/shared/modules/visa/visa.catalog"
import {
  currencyOf,
  VISA_ORIGIN_LABELS,
  type VisaOriginCode,
  type VisaSettings,
} from "@/shared/modules/visa/visa.settings"
import type { VisaOrderDTO } from "@/shared/modules/visa/visa.entity"

const STATUS_LABELS: Record<string, string> = {
  new: "待处理",
  locked: "已锁定",
  booking: "预约中",
  queued: "排号中",
  brushing: "刷位中",
  revising: "待修改",
  done: "已完成",
  cancelled: "已取消",
}

/** 只有已取消的订单能归档，和服务端保持一致 */
function canArchive(order: VisaOrderDTO) {
  return !order.archived && order.status === "cancelled"
}

const PAGE_SIZE = 10

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function formatTime(time: number) {
  const date = new Date(time)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function Field({ label, value }: { label: string; value: string | number }) {
  const text = value === "" || value === undefined || value === null ? "" : String(value)

  async function copy() {
    if (!text) return
    await navigator.clipboard.writeText(text)
    toast.success("已复制")
  }

  return (
    <div className="grid gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        onClick={copy}
        title={text ? "点击复制" : undefined}
        className={cn("text-sm break-words", text && "cursor-pointer hover:text-brand")}
      >
        {text || "—"}
      </span>
    </div>
  )
}

export function VisaOrdersPage() {
  const [orders, setOrders] = useState<VisaOrderDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [originFilter, setOriginFilter] = useState("all")
  const [countryFilter, setCountryFilter] = useState("all")
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<VisaOrderDTO | null>(null)
  const [positionDraft, setPositionDraft] = useState("")
  const [noteDraft, setNoteDraft] = useState("")
  const [datesDraft, setDatesDraft] = useState("")
  const [attaching, setAttaching] = useState(false)
  const [archived, setArchived] = useState<VisaOrderDTO[]>([])
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [revisionDraft, setRevisionDraft] = useState("")
  const [photos, setPhotos] = useState<{ index: number; url: string }[]>([])
  const [photoUrl, setPhotoUrl] = useState("")
  const [settings, setSettings] = useState<VisaSettings | null>(null)
  const [fx, setFx] = useState<{ rate: number; date: string; source: string } | null>(null)
  const [candidates, setCandidates] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const letterInput = useRef<HTMLInputElement>(null)

  async function loadSettings() {
    const res = await visaApi.settings({})
    if (res.success && res.data?.settings) setSettings(res.data.settings)
  }

  async function loadFx() {
    const res = await visaApi.fx({})
    if (res.success) setFx(res.data?.fx ?? null)
  }

  async function loadArchived() {
    const res = await visaApi.archivedOrders({ auth: getAuth() })
    if (res.success) setArchived(res.data?.orders ?? [])
  }

  async function archiveOrder(order: VisaOrderDTO) {
    const res = await visaApi.orderArchive({ id: order.id, auth: getAuth() })
    if (!res.success) {
      toast.error(res.message || "归档失败")
      return
    }
    setSelected(null)
    setOrders((rows) => rows.filter((row) => row.id !== order.id))
    toast.success("已归档")
    await loadArchived()
  }

  async function restoreOrder(order: VisaOrderDTO) {
    const res = await visaApi.orderRestore({ id: order.id, auth: getAuth() })
    if (!res.success) {
      toast.error(res.message || "恢复失败")
      return
    }
    setArchiveOpen(false)
    toast.success("已恢复")
    await load()
    await loadArchived()
  }

  async function load() {
    setLoading(true)
    const res = await visaApi.orders({ auth: getAuth() })
    setLoading(false)
    if (res.success) {
      setOrders(res.data?.orders ?? [])
    } else {
      toast.error(res.message || "订单加载失败")
    }
  }

  useEffect(() => {
    load()
    void loadSettings()
    void loadFx()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [originFilter, countryFilter, keyword])

  function openOrder(order: VisaOrderDTO) {
    setSelected(order)
    setPositionDraft(order.position)
    setNoteDraft(order.appointment_note)
    setDatesDraft(order.appointment_dates.join("、"))
    setCandidates([])
    setPhotos([])
    void loadPhotos(order.id)
  }

  async function loadPhotos(id: string) {
    const res = await visaApi.passportPhotos({ id, auth: getAuth() })
    if (res.success) setPhotos(res.data?.photos ?? [])
  }

  function applyOrder(updated: VisaOrderDTO) {
    setSelected(updated)
    setOrders((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
  }

  async function setStatus(status: string) {
    if (!selected) return
    const res = await visaApi.orderSetStatus({ id: selected.id, status, auth: getAuth() })
    if (res.success && res.data?.order) {
      applyOrder(res.data.order)
      toast.success("状态已更新")
      return
    }
    toast.error(res.message || "操作失败")
  }

  async function savePosition() {
    if (!selected) return
    const res = await visaApi.orderPosition({
      id: selected.id,
      position: positionDraft,
      auth: getAuth(),
    })
    if (res.success && res.data?.order) {
      applyOrder(res.data.order)
      toast.success("已保存预约位置")
      return
    }
    toast.error(res.message || "保存失败")
  }

  async function saveNote() {
    if (!selected) return
    const res = await visaApi.orderNote({
      id: selected.id,
      appointment_note: noteDraft,
      auth: getAuth(),
    })
    if (res.success && res.data?.order) {
      applyOrder(res.data.order)
      toast.success("已保存")
      return
    }
    toast.error(res.message || "保存失败")
  }

  async function saveDates() {
    if (!selected) return
    const dates = datesDraft
      .split(/[、,，\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    const res = await visaApi.orderDates({
      id: selected.id,
      appointment_dates: dates,
      auth: getAuth(),
    })
    if (res.success && res.data?.order) {
      applyOrder(res.data.order)
      toast.success("已保存")
      return
    }
    toast.error(res.message || "保存失败")
  }

  async function submitRevision() {
    if (!selected) return
    const note = revisionDraft.trim()
    if (!note) {
      toast.error("请填写修改目标")
      return
    }
    const res = await visaApi.orderRevision({
      id: selected.id,
      revision_note: note,
      auth: getAuth(),
    })
    if (res.success && res.data?.order) {
      applyOrder(res.data.order)
      setRevisionOpen(false)
      toast.success("已标记待修改")
      return
    }
    toast.error(res.message || "保存失败")
  }

  async function toggleForm(index: number, checked: boolean) {
    if (!selected) return
    const current = selected.form_filled ?? []
    const next = checked
      ? [...current, index].sort((a, b) => a - b)
      : current.filter((item) => item !== index)
    const res = await visaApi.orderForm({
      id: selected.id,
      form_filled: next,
      auth: getAuth(),
    })
    if (res.success && res.data?.order) {
      applyOrder(res.data.order)
      return
    }
    toast.error(res.message || "保存失败")
  }

  async function removeFile(fileId: string) {
    if (!selected) return
    const res = await visaApi.orderFileRemove({
      id: selected.id,
      file_id: fileId,
      auth: getAuth(),
    })
    if (res.success && res.data?.order) {
      applyOrder(res.data.order)
      toast.success("已删除")
      return
    }
    toast.error(res.message || "删除失败")
  }

  async function uploadLetter(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (!picked.length || !selected) return

    setAttaching(true)
    try {
      let uploaded = 0
      for (const file of picked) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result ?? ""))
          reader.onerror = () => reject(new Error("读取文件失败"))
          reader.readAsDataURL(file)
        })

        const res = await visaApi.orderAttach({
          id: selected.id,
          name: file.name,
          data,
          auth: getAuth(),
        })
        if (res.success && res.data?.order) {
          uploaded += 1
          applyOrder(res.data.order)
        }
      }

      if (uploaded === 0) {
        toast.error("上传失败")
        return
      }
      toast.success(
        uploaded > 1 ? `${uploaded} 份预约信已上传，订单已完成` : "预约信已上传，订单已完成",
      )
      void parseDates()
    } finally {
      setAttaching(false)
    }
  }

  async function parseDates() {
    if (!selected) return
    const res = await visaApi.letterDates({ id: selected.id, auth: getAuth() })
    if (!res.success) {
      toast.error(res.message || "解析失败")
      return
    }
    const dates = res.data?.dates ?? []
    setCandidates(dates)
    if (!dates.length) toast.error("预约信里没认出日期时间")
  }

  function toggleStamp(stamp: string) {
    setPositionDraft((current) => {
      if (current.includes(stamp)) {
        return current
          .replace(stamp, "")
          .replace(/\s*·\s*·\s*/g, " · ")
          .replace(/^\s*·\s*|\s*·\s*$/g, "")
          .trim()
      }
      return current.trim() ? `${current.trim()} · ${stamp}` : stamp
    })
  }
  const filtered = orders
    .filter((order) => {
      if (originFilter !== "all" && order.origin_code !== originFilter) return false
      if (countryFilter !== "all" && order.country_code !== countryFilter) return false
      const text = keyword.trim().toLowerCase()
      if (!text) return true
      return [
        order.id,
        order.customer_email,
        order.customer_name,
        order.appointment_city,
        order.appointment_note,
        ...order.passports.flatMap((passport) => [
          passport.first_name,
          passport.last_name,
          passport.passport_number,
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(text)
    })
    // 待修改的排最前面
    .sort((a, b) => Number(b.status === "revising") - Number(a.status === "revising"))

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">订单</h2>
          <p className="text-muted-foreground text-sm">
            共 {filtered.length} 单。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setArchiveOpen(true)
              void loadArchived()
            }}
          >
            <Archive className="size-4" />
            已归档 {archived.length || ""}
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            刷新
          </Button>
        </div>
      </div>

      {settings && (
        <Card>
          <CardContent className="grid gap-2">
            <p className="text-sm font-semibold">汇率</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-xs">1 英镑 =</span>
              <span className="text-sm font-semibold">
                {fx ? fx.rate.toFixed(4) : "—"} 人民币
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => void loadFx()}
              >
                刷新
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={originFilter}
          onChange={(event) => setOriginFilter(event.target.value)}
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="all">全部出发地</option>
          {(Object.keys(VISA_ORIGIN_LABELS) as VisaOriginCode[]).map((code) => (
            <option key={code} value={code}>
              {VISA_ORIGIN_LABELS[code]}
            </option>
          ))}
        </select>

        <select
          value={countryFilter}
          onChange={(event) => setCountryFilter(event.target.value)}
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="all">全部目的地</option>
          {VISA_COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>

        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="单号 / 城市 / 姓名 / 护照号 / 备注"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">最近订单</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">正在加载…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {orders.length ? "没有符合条件的订单。" : "还没有订单。"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>下单时间</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>目的地</TableHead>
                  <TableHead>人数</TableHead>
                  <TableHead>递签</TableHead>
                  <TableHead>出行</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => openOrder(order)}
                  >
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {formatTime(order.create_time)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{order.customer_name || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{order.country_name}</span>
                    </TableCell>
                    <TableCell>{order.travelers}</TableCell>
                    <TableCell>
                      <span>{order.appointment_city}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {formatDates(order.appointment_dates)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {order.travel_date} · {order.trip_days} 天
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {currencyOf(order.origin_code).symbol}
                      {order.total}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs">查看</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pageCount > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs">
              <span className="text-muted-foreground">
                第 {currentPage} / {pageCount} 页
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                上一页
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>订单 {selected?.id}</DialogTitle>
            <DialogDescription>
              {selected?.origin_label}出发 · {selected?.country_name} {selected?.visa} ·{" "}
              {formatTime(selected?.create_time ?? 0)}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="下单人" value={selected.customer_name} />
                <Field label="邮箱" value={selected.customer_email} />
                <Field label="手机号" value={selected.customer_phone} />
                <Field label="出行人数" value={`${selected.travelers} 人`} />
                <Field
                  label="附加服务"
                  value={[selected.flight && "机票代订", selected.hotel && "酒店预订"]
                    .filter(Boolean)
                    .join("、") || "无"}
                />
                <Field label="出行日期" value={selected.travel_date} />
                <Field label="行程天数" value={`${selected.trip_days} 天`} />
                <Field
                  label="刷位意愿"
                  value={VISA_SLOT_SUPPORT_LABELS[selected.slot_support] ?? "视情况"}
                />
              </div>

              <div>
                <p className="text-muted-foreground mb-2 text-xs font-semibold">
                  护照信息（{selected.passports.length} 位出行人）
                </p>
                <div className="space-y-2">
                  {selected.passports.map((passport, index) => {
                    const photo = photos.find((item) => item.index === index)
                    return (
                    <div key={index} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <p className="text-muted-foreground text-xs font-semibold">
                            出行人 {index + 1}
                          </p>
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={(selected.form_filled ?? []).includes(index)}
                              onChange={(event) => void toggleForm(index, event.target.checked)}
                              className="size-3.5"
                            />
                            表单已填
                          </label>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {Boolean(passport.name_cn?.trim()) ? (
                          <Field label="中文姓名" value={passport.name_cn ?? ""} />
                        ) : (
                          <div />
                        )}
                        <Field label="名拼写" value={passport.first_name} />
                        <Field label="姓拼写" value={passport.last_name} />
                        <Field label="手机号" value={passport.phone} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Field label="性别" value={passport.gender} />
                        <Field label="出生日期" value={passport.birth_date} />
                        <Field label="国籍" value={passport.nationality} />
                        <Field label="出生地" value={passport.birth_place} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Field label="护照号" value={passport.passport_number} />
                        <Field label="签发日期" value={passport.issue_date} />
                        <Field label="有效期至" value={passport.expiry_date} />
                        <div>
                          <p className="text-muted-foreground text-xs">护照原件</p>
                          {photo ? (
                            <button
                              type="button"
                              onClick={() => setPhotoUrl(photo.url)}
                              className="text-sm font-semibold text-brand hover:underline"
                            >
                              查看
                            </button>
                          ) : (
                            <p className="text-sm">—</p>
                          )}
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-muted-foreground mb-2 text-xs font-semibold">递签</p>
                <div className="grid gap-3">
                  <Field label="签证中心" value={selected.appointment_city} />
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">候选日期</span>
                    <Input
                      value={datesDraft}
                      onChange={(event) => setDatesDraft(event.target.value)}
                      placeholder="2026-11-30、2026-12-08"
                      className="h-8 flex-1"
                    />
                    <Button size="sm" variant="outline" className="h-8" onClick={() => void saveDates()}>
                      保存
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">备注</span>
                    <Input
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder="给客户的备注"
                      className="h-8 flex-1"
                    />
                    <Button size="sm" variant="outline" className="h-8" onClick={() => void saveNote()}>
                      保存
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-1.5 rounded-md border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">签证费（代官方收取）</span>
                  <span>
                    {currencyOf(selected.origin_code).symbol}
                    {selected.visa_fee}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">服务费</span>
                  <span>
                    {currencyOf(selected.origin_code).symbol}
                    {selected.service_fee}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">附加服务</span>
                  <span>
                    {currencyOf(selected.origin_code).symbol}
                    {selected.extras_fee}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1.5 font-semibold">
                  <span>总价</span>
                  <span>
                    {currencyOf(selected.origin_code).symbol}
                    {selected.total}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="text-muted-foreground text-xs">
                  {selected.status === "new"
                    ? "未确认收款，用户还可以自己改单。"
                    : "已进入处理流程，用户无法自己改单。"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.status === "new" && (
                    <Button size="sm" onClick={() => setStatus("locked")}>
                      确认收款并锁定
                    </Button>
                  )}
                  {selected.status === "locked" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus("booking")}>
                      标记预约中
                    </Button>
                  )}
                  {selected.status === "booking" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus("queued")}>
                      标记排号中
                    </Button>
                  )}
                  {(selected.status === "booking" || selected.status === "queued") && (
                    <Button size="sm" variant="outline" onClick={() => setStatus("brushing")}>
                      标记刷位中
                    </Button>
                  )}
                  {(selected.status === "queued" || selected.status === "brushing") && (
                    <Button size="sm" variant="outline" onClick={() => setStatus("booking")}>
                      退回预约中
                    </Button>
                  )}
                  {["locked", "booking", "queued", "brushing", "revising"].includes(selected.status) && (
                    <Button size="sm" variant="outline" onClick={() => setStatus("done")}>
                      标记已完成
                    </Button>
                  )}
                  {selected.status !== "new" && selected.status !== "cancelled" && selected.status !== "revising" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRevisionDraft(selected.revision_note ?? "")
                        setRevisionOpen(true)
                      }}
                    >
                      标记待修改
                    </Button>
                  )}
                  {selected.status !== "new" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus("new")}>
                      退回待处理
                    </Button>
                  )}
                  {selected.status !== "cancelled" && (
                    <Button size="sm" variant="outline" onClick={() => setConfirmCancel(true)}>
                      取消订单
                    </Button>
                  )}
                  {canArchive(selected) && (
                    <Button size="sm" variant="outline" onClick={() => archiveOrder(selected)}>
                      <Archive className="mr-1.5 size-3.5" />
                      归档
                    </Button>
                  )}
                </div>
              </div>

              {selected.status !== "new" && (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid gap-1.5">
                    <span className="text-muted-foreground text-xs">预约到的位置</span>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={positionDraft}
                        onChange={(event) => setPositionDraft(event.target.value)}
                        placeholder="例如：北京签证中心 3 号窗口 · 2027-01-05 上午"
                        className="min-w-64 flex-1"
                      />
                      <Button size="sm" variant="outline" onClick={savePosition}>
                        保存
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void parseDates()}>
                        从预约信识别
                      </Button>
                    </div>
                    {candidates.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {candidates.map((stamp) => {
                          const on = positionDraft.includes(stamp)
                          return (
                            <button
                              key={stamp}
                              type="button"
                              onClick={() => toggleStamp(stamp)}
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs transition",
                                on
                                  ? "border-brand bg-brand/10 text-brand"
                                  : "text-muted-foreground hover:border-brand/40",
                              )}
                            >
                              {stamp}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-1.5">
                    <span className="text-muted-foreground text-xs">预约信（上传后订单变为已完成）</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={attaching}
                        onClick={() => letterInput.current?.click()}
                      >
                        <Upload className="mr-1.5 size-3.5" />
                        {attaching ? "上传中…" : "上传 PDF"}
                      </Button>
                      <input
                        ref={letterInput}
                        type="file"
                        accept="application/pdf"
                        multiple
                        className="hidden"
                        onChange={uploadLetter}
                      />
                      {selected.files.map((file) => (
                        <span key={file.id} className="flex items-center gap-1">
                          <a
                            href={`/api/visa/file?id=${file.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline underline-offset-2"
                          >
                            {file.name}
                          </a>
                          {selected.status === "revising" && (
                            <button
                              type="button"
                              onClick={() => void removeFile(file.id)}
                              className="text-muted-foreground text-xs transition hover:text-destructive"
                            >
                              删除
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>取消这个订单？</DialogTitle>
            <DialogDescription>
              取消后客户看到「已取消」，不能再改单。要撤销就点订单里的「退回待处理」。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              再想想
            </Button>
            <Button
              onClick={() => {
                setConfirmCancel(false)
                void setStatus("cancelled")
              }}
            >
              取消订单
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>标记待修改</DialogTitle>
            <DialogDescription>写清要改什么，客户在订单页能看到。</DialogDescription>
          </DialogHeader>
          <Textarea
            value={revisionDraft}
            onChange={(event) => setRevisionDraft(event.target.value)}
            rows={4}
            placeholder="例如：护照首页照片反光，重新拍一张"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setRevisionOpen(false)}>
              取消
            </Button>
            <Button disabled={!revisionDraft.trim()} onClick={() => void submitRevision()}>
              标记
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(photoUrl)} onOpenChange={(open) => !open && setPhotoUrl("")}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>护照原件</DialogTitle>
          </DialogHeader>
          {photoUrl && (
            <img src={photoUrl} alt="护照原件" className="w-full rounded-lg bg-white" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>已归档的订单</DialogTitle>
          </DialogHeader>
          {archived.length === 0 ? (
            <p className="text-muted-foreground text-sm">还没有归档的订单。</p>
          ) : (
            <div className="space-y-2">
              {archived.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {order.id} · {order.country_name} {order.visa}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {order.customer_name} · {formatTime(order.create_time)} ·{" "}
                      {STATUS_LABELS[order.status] ?? order.status}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restoreOrder(order)}>
                    恢复
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
