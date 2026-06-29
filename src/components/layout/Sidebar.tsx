"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon, IconBadge } from "@/components/ui/Icon";
import {
  Sun,
  MessageSquare,
  Mail,
  Calendar,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Sparkles,
  Database,
  Wand2,
  ScanLine,
  Newspaper,
  HeartPulse,
  Calculator,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/lib/store/app-context";
import { Avatar } from "@/components/ui/Avatar";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  activeBg: string;
  accent: string;
};

const navItems: NavItem[] = [
  {
    href: "/chat",
    label: "AI Chat",
    icon: MessageSquare,
    iconBg: "bg-violet-500/20",
    iconColor: "text-violet-300",
    activeBg: "bg-violet-500/30",
    accent: "bg-violet-400",
  },
  {
    href: "/dashboard",
    label: "Daily Briefing",
    icon: Sun,
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-300",
    activeBg: "bg-amber-500/30",
    accent: "bg-amber-400",
  },
  {
    href: "/news",
    label: "News & Markets",
    icon: Newspaper,
    iconBg: "bg-sky-500/20",
    iconColor: "text-sky-300",
    activeBg: "bg-sky-500/30",
    accent: "bg-sky-400",
  },
  {
    href: "/email",
    label: "Email",
    icon: Mail,
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-300",
    activeBg: "bg-blue-500/30",
    accent: "bg-blue-400",
  },
  {
    href: "/calendar",
    label: "Calendar & Tasks",
    icon: Calendar,
    iconBg: "bg-rose-500/20",
    iconColor: "text-rose-300",
    activeBg: "bg-rose-500/30",
    accent: "bg-rose-400",
  },
  {
    href: "/sales",
    label: "Sales Dashboard",
    icon: BarChart3,
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-300",
    activeBg: "bg-emerald-500/30",
    accent: "bg-emerald-400",
  },
  {
    href: "/calculator",
    label: "Price Calculator",
    icon: Calculator,
    iconBg: "bg-yellow-500/20",
    iconColor: "text-yellow-300",
    activeBg: "bg-yellow-500/30",
    accent: "bg-yellow-400",
  },
  {
    href: "/analyst",
    label: "Data Analyst",
    icon: Database,
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-300",
    activeBg: "bg-cyan-500/30",
    accent: "bg-cyan-400",
  },
  {
    href: "/images",
    label: "Image Generation",
    icon: Wand2,
    iconBg: "bg-fuchsia-500/20",
    iconColor: "text-fuchsia-300",
    activeBg: "bg-fuchsia-500/30",
    accent: "bg-fuchsia-400",
  },
  {
    href: "/scan",
    label: "Doc Scanner",
    icon: ScanLine,
    iconBg: "bg-teal-500/20",
    iconColor: "text-teal-300",
    activeBg: "bg-teal-500/30",
    accent: "bg-teal-400",
  },
  {
    href: "/health",
    label: "Health",
    icon: HeartPulse,
    iconBg: "bg-pink-500/20",
    iconColor: "text-pink-300",
    activeBg: "bg-pink-500/30",
    accent: "bg-pink-400",
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: Users,
    iconBg: "bg-indigo-500/20",
    iconColor: "text-indigo-300",
    activeBg: "bg-indigo-500/30",
    accent: "bg-indigo-400",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    iconBg: "bg-slate-500/25",
    iconColor: "text-slate-300",
    activeBg: "bg-slate-500/35",
    accent: "bg-slate-400",
  },
];

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[13px] transition-all duration-200",
        active
          ? "nav-pill-active text-white font-semibold"
          : "text-ink-secondary font-medium hover:text-white hover:bg-white/8"
      )}
    >
      {active && (
        <span className={cn("absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full", item.accent)} />
      )}
      <IconBadge
        icon={item.icon}
        iconBg={item.iconBg}
        iconColor={item.iconColor}
        activeBg={item.activeBg}
        active={active}
        size="md"
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { state, logout } = useApp();

  return (
    <aside className="hidden lg:flex flex-col w-[15.5rem] shrink-0 p-3 h-screen sticky top-0">
      <div className="glass-panel-strong flex flex-col flex-1 rounded-3xl overflow-hidden text-ink">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="app-logo-badge icon-badge flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-violet-400/40 shrink-0">
              <Icon icon={Sparkles} size="xl" className="text-amber-300" active />
            </span>
            <div className="min-w-0">
              <h1 className="text-ink font-semibold text-sm tracking-wide">Alexa</h1>
              <p className="text-ink-muted text-[11px] tracking-wide">executive assistance</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        <div className="p-3 m-2 mt-0 rounded-2xl bg-black/20 ring-1 ring-white/10">
          <div className="flex items-center gap-2.5 px-1 py-0.5">
            <Avatar name={state?.user?.name || "Kash"} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">Kash</p>
              <p className="text-[11px] text-ink-muted truncate">{state?.user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="text-ink-muted hover:text-rose-300 transition-colors p-1"
              title="Logout"
            >
              <Icon icon={LogOut} size="sm" className="text-current" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { state, logout } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const active = navItems.find((i) => i.href === pathname);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 glass-panel-strong text-ink safe-area-top mx-3 mt-3 rounded-2xl">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="app-logo-badge icon-badge flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ring-1 ring-violet-400/35">
              <Icon icon={Sparkles} size="lg" className="text-amber-300" active />
            </span>
            <div className="min-w-0">
              <p className="text-ink font-semibold text-sm leading-none">Alexa</p>
              <p className="text-ink-muted text-[11px] truncate leading-tight mt-0.5">
                {active?.label ?? "executive assistance"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="p-2 -mr-2 text-ink-secondary hover:text-white transition-colors"
          >
            <Icon icon={Menu} size="lg" />
          </button>
        </div>
      </header>

      <div
        className={cn(
          "lg:hidden fixed inset-0 z-50 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <aside
          className={cn(
            "absolute top-0 right-0 h-full w-[85%] max-w-xs glass-panel-strong text-ink flex flex-col shadow-elevated transition-transform duration-300 safe-area-top",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 flex-shrink-0">
            <span className="text-ink font-semibold text-sm">Alexa</span>
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-1 text-ink-muted hover:text-white">
              <Icon icon={X} size="lg" />
            </button>
          </div>

          <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} active={pathname === item.href} onClick={() => setOpen(false)} />
            ))}
          </nav>

          <div className="p-3 border-t border-white/10 flex-shrink-0 safe-area-bottom">
            <div className="flex items-center gap-2.5">
              <Avatar name={state?.user?.name || "Kash"} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">Kash</p>
                <p className="text-[11px] text-ink-muted truncate">{state?.user?.role}</p>
              </div>
              <button onClick={logout} className="text-ink-muted hover:text-rose-300" title="Logout">
                <Icon icon={LogOut} size="sm" className="text-current" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[1.65rem] font-display font-semibold text-ink tracking-tight">{title}</h1>
        {subtitle && <p className="text-ink-muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
