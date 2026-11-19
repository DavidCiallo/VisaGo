import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Download, Moon, Sun, Monitor, Upload } from "lucide-react"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/client/components/ui/card"
import { Button } from "@/client/components/ui/button"
import { Input } from "@/client/components/ui/input"
import { Label } from "@/client/components/ui/label"
import { Separator } from "@/client/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog"
import { useTheme } from "@/client/components/theme-provider"
import { cn } from "@/client/lib/utils"
import { toast } from "@/client/methods/notify"
import { visaApi } from "@/client/api/instance"
import { getAuth } from "@/client/methods/auth"
import type { VisaBackup } from "@/shared/modules/visa/visa.interface"
import {
  notifyOf,
  type VisaNotify,
  type VisaSettings,
} from "@/shared/modules/visa/visa.settings"

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<VisaBackup | null>(null)
  const [importing, setImporting] = useState(false)
  const [settings, setSettings] = useState<VisaSettings | null>(null)
  const [notify, setNotify] = useState<VisaNotify | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await visaApi.settings({})
      if (!res.success || !res.data?.settings) return
      setSettings(res.data.settings)
      setNotify(notifyOf(res.data.settings))
    })()
  }, [])

  async function saveNotify() {
    if (!settings || !notify) return
    const res = await visaApi.saveSettings({
      settings: { ...settings, notify },
      auth: getAuth(),
    })
    if (!res.success || !res.data?.settings) {
      toast.error(res.message || "保存失败")
      return
    }
    setSettings(res.data.settings)
    setNotify(notifyOf(res.data.settings))
    toast.success("已保存")
  }

  async function testNotify() {
    await saveNotify()
    const res = await visaApi.notifyTest({ auth: getAuth() })
    if (res.success) toast.success("已发出去")
    else toast.error(res.message || "发送失败")
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault()
    toast.success("Settings saved")
  }

  async function exportData() {
    const res = await visaApi.exportData({ auth: getAuth() })
    if (!res.success || !res.data?.backup) {
      toast.error(res.message || "导出失败")
      return
    }

    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")
    const blob = new Blob([JSON.stringify(res.data.backup, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `visago-${stamp}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("已导出")
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as VisaBackup
        if (!Array.isArray(parsed.orders)) throw new Error("bad")
        setPending(parsed)
      } catch {
        toast.error("这个文件不是本系统导出的备份")
      }
    })
  }

  async function runImport() {
    if (!pending) return
    setImporting(true)
    const res = await visaApi.importData({ backup: pending, auth: getAuth() })
    setImporting(false)

    if (!res.success) {
      toast.error(res.message || "导入失败")
      return
    }

    const counts = res.data
    setPending(null)
    toast.success(
      `已导入 ${counts?.orders ?? 0} 单、${counts?.customers ?? 0} 位客户、${counts?.pay_codes ?? 0} 张收款码、${counts?.files ?? 0} 个文件`,
    )
    // 整库都换了，其它页面手里还是旧数据，直接刷一遍
    window.setTimeout(() => window.location.reload(), 800)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground text-sm">
          Manage your account preferences and appearance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name and email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how visago looks to you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <ThemeOption
              label="Light"
              icon={Sun}
              active={theme === "light"}
              onClick={() => setTheme("light")}
            />
            <ThemeOption
              label="Dark"
              icon={Moon}
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
            />
            <ThemeOption
              label="System"
              icon={Monitor}
              active={theme === "system"}
              onClick={() => setTheme("system")}
            />
          </div>
          <Separator className="my-4" />
          <p className="text-muted-foreground text-xs">
            Preferences are stored locally in your browser.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>通知</CardTitle>
          <CardDescription>新订单直接推给机器人，缺任何一项都不发。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {notify && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="notify-url">机器人地址</Label>
                  <Input
                    id="notify-url"
                    value={notify.qq_url}
                    onChange={(event) => setNotify({ ...notify, qq_url: event.target.value })}
                    placeholder="http://8.133.217.12:8989"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notify-target">会话 ID</Label>
                  <Input
                    id="notify-target"
                    value={notify.qq_target}
                    onChange={(event) => setNotify({ ...notify, qq_target: event.target.value })}
                    placeholder="单聊 userid 或群聊 chatid"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notify-type">会话类型</Label>
                  <select
                    id="notify-type"
                    value={notify.qq_type ?? ""}
                    onChange={(event) => setNotify({ ...notify, qq_type: event.target.value })}
                    className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="">自动</option>
                    <option value="single">单聊</option>
                    <option value="group">群聊</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notify-token">访问令牌</Label>
                  <Input
                    id="notify-token"
                    value={notify.qq_token}
                    onChange={(event) => setNotify({ ...notify, qq_token: event.target.value })}
                    placeholder="没有就留空"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveNotify()}>保存</Button>
                <Button variant="outline" onClick={() => void testNotify()}>
                  发条测试消息
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>数据备份</CardTitle>
          <CardDescription>
            导出的文件里是全部订单、客户、收款码、签证配置，以及收款码图片和预约信 PDF。导入会用文件内容替换整个库。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button onClick={exportData}>
            <Download className="size-4" />
            导出备份
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            导入备份
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={pickFile}
          />
        </CardContent>
      </Card>

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>用这个文件替换整个库？</DialogTitle>
            <DialogDescription>
              {pending
                ? `${pending.orders.length} 单、${pending.customers.length} 位客户、${pending.pay_codes?.length ?? 0} 张收款码。`
                : ""}
              现在的订单、客户、收款码和配置会全部被覆盖，不能撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setPending(null)} disabled={importing}>
              取消
            </Button>
            <Button onClick={runImport} disabled={importing}>
              {importing ? "导入中…" : "替换"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ThemeOption({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border hover:border-primary/50 hover:bg-accent"
      )}
    >
      <Icon className="size-5" />
      {label}
    </button>
  )
}
