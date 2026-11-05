import { NavLink } from "react-router-dom"
import { Plane, ClipboardList, QrCode, Settings, type LucideIcon } from "lucide-react"

import { cn } from "@/client/lib/utils"
import { Badge } from "@/client/components/ui/badge"
import { Locale } from "@/client/methods/locale"
import logoUrl from "@/client/assets/logo.svg"

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  badge?: string
}

const mainNav: NavItem[] = [
  { title: "Visa", href: "/visa-settings", icon: Plane },
  { title: "Orders", href: "/visa-orders", icon: ClipboardList },
  { title: "收款码", href: "/visa-pay-codes", icon: QrCode },
]

const secondaryNav: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
]

export function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const locale = Locale("Menu")

  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <img src={logoUrl} alt="" className="size-8" aria-hidden="true" />
        <span className="text-lg font-semibold tracking-tight">visago</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="text-muted-foreground px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider">
          {locale.Workspace}
        </p>
        {mainNav.map((item) => (
          <SidebarItem key={item.href} item={item} locale={locale} onNavigate={onNavigate} />
        ))}

        <p className="text-muted-foreground px-3 pb-2 pt-6 text-xs font-semibold uppercase tracking-wider">
          {locale.General}
        </p>
        {secondaryNav.map((item) => (
          <SidebarItem key={item.href} item={item} locale={locale} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-t p-3">
        <div className="bg-sidebar-accent text-sidebar-accent-foreground rounded-lg p-3 text-xs">
          <p className="font-medium">{locale.AdminPanel}</p>
        </div>
      </div>
    </>
  )
}

export function DesktopSidebar() {
  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden h-screen w-60 shrink-0 flex-col border-r md:flex">
      <SidebarBody />
    </aside>
  )
}

function SidebarItem({
  item,
  locale,
  onNavigate,
}: {
  item: NavItem
  locale: { [key: string]: string }
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.href}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80"
        )
      }
    >
      <Icon className="size-4" />
      <span className="flex-1">{locale[item.title]}</span>
      {item.badge && (
        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
          {item.badge}
        </Badge>
      )}
    </NavLink>
  )
}
