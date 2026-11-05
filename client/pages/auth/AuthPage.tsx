import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Lock, Mail, Loader2 } from "lucide-react"

import { Button } from "@/client/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/client/components/ui/card"
import { Input } from "@/client/components/ui/input"
import { Label } from "@/client/components/ui/label"
import { LanguageToggle } from "@/client/components/language-toggle"
import { ThemeToggle } from "@/client/components/theme-toggle"
import { authApi } from "@/client/api/instance"
import { setAuth } from "@/client/methods/auth"
import { toast } from "@/client/methods/notify"
import { Locale } from "@/client/methods/locale"

export function AuthPage() {
  const navigate = useNavigate()
  const locale = Locale("AuthPage")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await authApi.login({ identify: { email, password } })
    setLoading(false)
    if (res.success && res.data?.token) {
      setAuth(res.data.token)
      toast.success(locale.SignInSuccess)
      navigate("/visa-orders")
    } else {
      toast.error(res.message || locale.SignInFailed)
    }
  }

  return (
    <div className="bg-muted/30 relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle variant="ghost" />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-2 flex size-12 items-center justify-center rounded-xl text-xl font-bold">
            V
          </div>          <CardTitle className="text-2xl">{locale.WelcomeBack}</CardTitle>
          <CardDescription>{locale.Description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onLogin} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{locale.EmailLabel}</Label>
              <div className="relative">
                <Mail className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  id="email"
                  type="email"
                  placeholder={locale.EmailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-8"
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{locale.PasswordLabel}</Label>
              <div className="relative">
                <Lock className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  id="password"
                  type="password"
                  placeholder={locale.PasswordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-8"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {locale.SigningIn}
                </>
              ) : (
                locale.SignIn
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
