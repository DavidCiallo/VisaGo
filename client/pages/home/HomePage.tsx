import { Link } from "react-router-dom"
import {
  LayoutDashboard,
  Newspaper,
  Users,
  FlaskConical,
  Terminal,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react"

import { Button } from "@/client/components/ui/button"
import { Badge } from "@/client/components/ui/badge"
import { LanguageToggle } from "@/client/components/language-toggle"
import { ThemeToggle } from "@/client/components/theme-toggle"
import { getAuthStatus, AuthStatus } from "@/client/methods/auth"
import { Locale } from "@/client/methods/locale"

export function HomePage() {
  const locale = Locale("HomePage")
  const isAuth = getAuthStatus() === AuthStatus.AUTH

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="border-b">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-sm font-bold">
              T
            </div>
            <span className="text-lg font-semibold tracking-tight">Tiny-Web</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle variant="ghost" />
            <ThemeToggle />
            <Button asChild size="sm" className="ml-2">
              <Link to={isAuth ? "/dashboard" : "/auth"}>
                {isAuth ? locale.EnterPanel : locale.Login}
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <Badge variant="secondary" className="mb-4">
          <Zap className="size-3" />
          {locale.Badge}
        </Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {locale.HeroTitle1}
          <span className="text-primary"> {locale.HeroHighlight} </span>
          {locale.HeroTitle2}
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
          {locale.HeroDesc}
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link to={isAuth ? "/dashboard" : "/auth"}>
              {locale.GetStarted}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="https://github.com" target="_blank" rel="noreferrer">
              <Terminal className="size-4" />
              {locale.ViewSource}
            </a>
          </Button>
        </div>
      </section>

      {/* Bento Grid */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Dashboard - large card */}
          <div className="bg-card border-border group relative overflow-hidden rounded-2xl border p-6 sm:col-span-2 lg:row-span-2">
            <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-xl">
              <LayoutDashboard className="size-5" />
            </div>
            <h3 className="text-lg font-semibold">{locale.FeatureDashboardTitle}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {locale.FeatureDashboardDesc}
            </p>
            {/* Mock chart */}
            <div className="mt-6 flex items-end gap-2">
              {[35, 55, 40, 70, 50, 80, 65, 90, 75, 60, 85, 95].map((h, i) => (
                <div
                  key={i}
                  className="bg-primary/20 group-hover:bg-primary/40 flex-1 rounded-t-sm transition-all duration-300"
                  style={{ height: `${h * 0.8}px` }}
                />
              ))}
            </div>
          </div>

          {/* Blog */}
          <div className="bg-card border-border group rounded-2xl border p-6">
            <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-xl">
              <Newspaper className="size-5" />
            </div>
            <h3 className="text-lg font-semibold">{locale.FeatureBlogTitle}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {locale.FeatureBlogDesc}
            </p>
          </div>

          {/* Accounts */}
          <div className="bg-card border-border group rounded-2xl border p-6">
            <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-xl">
              <Users className="size-5" />
            </div>
            <h3 className="text-lg font-semibold">{locale.FeatureAccountsTitle}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {locale.FeatureAccountsDesc}
            </p>
          </div>

          {/* Demo / CRUD */}
          <div className="bg-card border-border group rounded-2xl border p-6">
            <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-xl">
              <FlaskConical className="size-5" />
            </div>
            <h3 className="text-lg font-semibold">{locale.FeatureDemoTitle}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {locale.FeatureDemoDesc}
            </p>
          </div>

          {/* Security */}
          <div className="bg-card border-border group rounded-2xl border p-6">
            <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-xl">
              <Shield className="size-5" />
            </div>
            <h3 className="text-lg font-semibold">{locale.FeatureAuthTitle}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {locale.FeatureAuthDesc}
            </p>
          </div>

          {/* Terminal / Tech Stack */}
          <div className="bg-card border-border group relative overflow-hidden rounded-2xl border p-6 sm:col-span-2">
            <div className="flex items-center gap-2 pb-3">
              <div className="size-3 rounded-full bg-red-400/80" />
              <div className="size-3 rounded-full bg-yellow-400/80" />
              <div className="size-3 rounded-full bg-green-400/80" />
              <span className="text-muted-foreground ml-2 text-xs">terminal</span>
            </div>
            <div className="font-mono text-sm leading-relaxed">
              <p className="text-muted-foreground">
                <span className="text-primary">$</span> bun run dev
              </p>
              <p className="text-muted-foreground mt-1">
                <span className="text-emerald-400">✓</span> {locale.TerminalReady}
              </p>
              <p className="text-muted-foreground mt-1">
                <span className="text-emerald-400">✓</span> {locale.TerminalServer}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Bun", "React 19", "TypeScript", "Tailwind CSS", "JSONL"].map((tech) => (
                <Badge key={tech} variant="outline" className="text-xs">
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm">
          <span>© 2026 Tiny-Web</span>
          <span>{locale.FooterText}</span>
        </div>
      </footer>
    </div>
  )
}
