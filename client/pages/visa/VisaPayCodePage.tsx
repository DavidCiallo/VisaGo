import { useEffect, useRef, useState, type ChangeEvent } from "react"
import jsQR from "jsqr"
import { Star, Trash2, Upload } from "lucide-react"

import { Button } from "@/client/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card"
import { Input } from "@/client/components/ui/input"
import { visaApi } from "@/client/api/instance"
import { getAuth } from "@/client/methods/auth"
import { cn } from "@/client/lib/utils"
import { toast } from "@/client/methods/notify"
import type { VisaOcrWord, VisaPayCode } from "@/shared/modules/visa/visa.interface"

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("读取文件失败"))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("图片读不出来"))
    image.src = src
  })
}

/** 价格下面那行小字（店名之类）太小，切出来放大四倍再识别一次。 */
async function cropRegion(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
  scale = 4,
): Promise<string> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(rect.width * scale))
  canvas.height = Math.max(1, Math.round(rect.height * scale))
  const context = canvas.getContext("2d")
  if (!context) return ""

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(
    image,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas.toDataURL("image/png")
}

/** 在一整张截图里找到二维码，只把二维码本体裁出来。 */
async function cropToQr(dataUrl: string): Promise<string | null> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext("2d")
  if (!context) return null

  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(pixels.data, pixels.width, pixels.height)
  if (!code?.location) return null

  const points = [
    code.location.topLeftCorner,
    code.location.topRightCorner,
    code.location.bottomLeftCorner,
    code.location.bottomRightCorner,
  ]
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const pad = Math.round(size * 0.08)
  const left = Math.max(0, Math.round(Math.min(...xs)) - pad)
  const top = Math.max(0, Math.round(Math.min(...ys)) - pad)
  const width = Math.min(canvas.width - left, Math.round(size) + pad * 2)
  const height = Math.min(canvas.height - top, Math.round(size) + pad * 2)

  const out = document.createElement("canvas")
  out.width = width
  out.height = height
  out.getContext("2d")?.drawImage(canvas, left, top, width, height, 0, 0, width, height)
  return out.toDataURL("image/png")
}

export function VisaPayCodePage() {
  const [codes, setCodes] = useState<VisaPayCode[]>([])
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("CNY")
  const [label, setLabel] = useState("")
  const [fallback, setFallback] = useState(false)
  const [image, setImage] = useState("")
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function toggleFallback(code: VisaPayCode) {
    const res = await visaApi.payCodeSave({
      id: code.id,
      amount: code.amount,
      currency: code.currency,
      label: code.label,
      fallback: !code.fallback,
      auth: getAuth(),
    })
    if (!res.success) {
      toast.error(res.message || "设置失败")
      return
    }
    toast.success(code.fallback ? "已取消兜底" : "已设为兜底")
    await load()
  }

  async function load() {
    const res = await visaApi.payCodeList({ auth: getAuth() })
    if (res.success) setCodes(res.data?.codes ?? [])
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("请粘贴或选择图片")
      return
    }

    setScanning(true)
    try {
      const original = await readAsDataUrl(file)
      const cropped = await cropToQr(original)
      setImage(cropped ?? original)

      const res = await visaApi.payCodeScan({ image: original, auth: getAuth() })
      if (!(res.success && res.data)) return

      const { amount, words } = res.data
      if (amount) setAmount(String(amount))

      const label = await readLabel(original, words)
      if (label) setLabel(label)
      if (!cropped) toast.success("没找到二维码，保留原图")
    } catch {
      toast.error("图片读不出来，换一张试试")
    } finally {
      setScanning(false)
    }
  }

  /** 价格下面那行小字就是备注，比如店名。 */
  async function readLabel(original: string, words: VisaOcrWord[]): Promise<string> {
    if (!words.length) return ""

    const amountWord =
      words.find((word) => /[¥￥$£]\s*\d/.test(word.text)) ??
      words.find((word) => /\d+[.,]\d{2}/.test(word.text))
    if (!amountWord) return ""

    const height = Math.max(8, amountWord.height)
    const rect = {
      x: Math.max(0, amountWord.x - height * 0.4),
      y: amountWord.y + height * 0.65,
      width: amountWord.width + height * 1.6,
      height: height * 1.3,
    }

    const crop = await cropRegion(original, rect, 6)
    if (!crop) return ""

    const res = await visaApi.payCodeScan({ image: crop, mode: "text", auth: getAuth() })
    const text = String(res.data?.text ?? "")
      .replace(/[¥￥$£]\s*\d+(?:[.,]\d{1,2})?/g, " ")
      .replace(/\b\d+[.,]\d{2}\b/g, " ")

    // 裁出来的那一行常混着价格残影，按「含汉字越多、越长越像店名」挑一个
    const tokens = text.split(/\s+/).filter(Boolean)
    const scored = tokens
      .map((token) => {
        const han = (token.match(/\p{Script=Han}/gu) ?? []).length
        return { token, score: han * 2 + (/-/.test(token) ? 1 : 0) + token.length * 0.2 }
      })
      .sort((a, b) => b.score - a.score)

    return (scored[0]?.token ?? "").slice(0, 24)
  }

  // 直接 Ctrl+V 粘贴截图
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const items = Array.from(event.clipboardData?.items ?? [])
      const item = items.find((entry) => entry.type.startsWith("image/"))
      const file = item?.getAsFile()
      if (file) void handleFile(file)
    }

    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [])

  useEffect(() => {
    void load()
  }, [])

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) await handleFile(file)
  }

  async function save() {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("请填写正确的金额")
      return
    }
    if (!image) {
      toast.error("请上传收款码图片")
      return
    }

    setSaving(true)
    const res = await visaApi.payCodeSave({
      amount: value,
      currency,
      label: label.trim(),
      fallback,
      image,
      auth: getAuth(),
    })
    setSaving(false)

    if (!res.success) {
      toast.error(res.message || "保存失败")
      return
    }
    setAmount("")
    setLabel("")
    setImage("")
    toast.success("收款码已保存")
    void load()
  }

  async function remove(id: string) {
    const res = await visaApi.payCodeRemove({ id, auth: getAuth() })
    if (!res.success) {
      toast.error(res.message || "删除失败")
      return
    }
    toast.success("已删除")
    void load()
  }

  async function move(from: number, to: number) {
    if (from === to) return

    const next = [...codes]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setCodes(next)

    const res = await visaApi.payCodeReorder({
      ids: next.map((code) => code.id),
      auth: getAuth(),
    })
    if (res.success && res.data?.codes) {
      setCodes(res.data.codes)
      return
    }

    toast.error(res.message || "排序没保存")
    void load()
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>新增收款码</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="border-muted-foreground/30 hover:border-primary/60 grid h-40 place-items-center overflow-hidden rounded-lg border border-dashed text-xs"
          >
            {image ? (
              <img src={image} alt="" className="size-full object-contain" />
            ) : (
              <span className="text-muted-foreground flex flex-col items-center gap-1">
                <Upload className="size-4" />
                {scanning ? "识别中…" : "上传或粘贴截图"}
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />

          <div className="grid gap-3">
            <div className="grid gap-1.5 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">金额</span>
                <Input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="numeric"
                  placeholder="例如 120"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">币种</span>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="CNY">人民币 ¥</option>
                  <option value="GBP">英镑 £</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-muted-foreground text-xs">备注（只给客户看，可留空）</span>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="例如：微信收款"
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={fallback}
                onChange={(event) => setFallback(event.target.checked)}
                className="size-3.5"
              />
              设为兜底码（没有金额匹配时用它）
            </label>
            <div>
              <Button onClick={save} disabled={saving}>
                {saving ? "保存中…" : "保存收款码"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已配置的收款码</CardTitle>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-muted-foreground text-sm">还没有收款码。</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {codes.map((code, index) => (
                <div
                  key={code.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) void move(dragIndex, index)
                    setDragIndex(null)
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={cn(
                    "cursor-grab rounded-lg border p-1.5 transition active:cursor-grabbing",
                    dragIndex === index && "opacity-40",
                  )}
                >
                  <img
                    src={code.url}
                    alt=""
                    draggable={false}
                    className="aspect-square w-full rounded bg-white object-contain"
                  />
                  <div className="mt-1 space-y-0.5">
                    <p
                      className={cn("text-xs font-medium", code.fallback && "text-brand")}
                      title={code.fallback ? "兜底码：没有金额匹配时用它" : undefined}
                    >
                      {code.fallback ? "★" : ""}
                      {code.currency === "GBP" ? "£" : "¥"}
                      {code.amount}
                    </p>
                    {code.label && (
                      <p className="text-muted-foreground truncate text-[10px]">{code.label}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn("size-6", code.fallback && "text-brand")}
                        onClick={() => toggleFallback(code)}
                        title={code.fallback ? "取消兜底" : "设为兜底"}
                      >
                        <Star className="size-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => remove(code.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
