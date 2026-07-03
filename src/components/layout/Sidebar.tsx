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
  Newspaper,
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
  ringColor: string;
  accent: string;
};

const navItems: NavItem[] = [
  {
    href: "/chat",
    label: "AI Chat",
    icon: MessageSquare,
    iconBg: "bg-violet-500/22",
    iconColor: "text-violet-300",
    activeBg: "bg-violet-500/32",
    ringColor: "ring-violet-400/28",
    accent: "bg-violet-400/85",
  },
  {
    href: "/dashboard",
    label: "Daily Briefing",
    icon: Sun,
    iconBg: "bg-amber-500/22",
    iconColor: "text-amber-300",
    activeBg: "bg-amber-500/32",
    ringColor: "ring-amber-400/28",
    accent: "bg-amber-400/85",
  },
  {
    href: "/news",
    label: "News & Markets",
    icon: Newspaper,
    iconBg: "bg-sky-500/22",
    iconColor: "text-sky-300",
    activeBg: "bg-sky-500/32",
    ringColor: "ring-sky-400/28",
    accent: "bg-sky-400/85",
  },
  {
    href: "/email",
    label: "Email",
    icon: Mail,
    iconBg: "bg-blue-500/22",
    iconColor: "text-blue-300",
    activeBg: "bg-blue-500/32",
    ringColor: "ring-blue-400/28",
    accent: "bg-blue-400/85",
  },
  {
    href: "/calendar",
    label: "Calendar & Tasks",
    icon: Calendar,
    iconBg: "bg-rose-500/22",
    iconColor: "text-rose-300",
    activeBg: "bg-rose-500/32",
    ringColor: "ring-rose-400/28",
    accent: "bg-rose-400/85",
  },
  {
    href: "/sales",
    label: "Sales Dashboard",
    icon: BarChart3,
    iconBg: "bg-emerald-500/22",
    iconColor: "text-emerald-300",
    activeBg: "bg-emerald-500/32",
    ringColor: "ring-emerald-400/28",
    accent: "bg-emerald-400/85",
  },
  {
    href: "/calculator",
    label: "Price Calculator",
    icon: Calculator,
    iconBg: "bg-yellow-500/22",
    iconColor: "text-yellow-300",
    activeBg: "bg-yellow-500/32",
    ringColor: "ring-yellow-400/28",
    accent: "bg-yellow-400/85",
  },
  {
    href: "/analyst",
    label: "Data Analyst",
    icon: Database,
    iconBg: "bg-cyan-500/22",
    iconColor: "text-cyan-300",
    activeBg: "bg-cyan-500/32",
    ringColor: "ring-cyan-400/28",
    accent: "bg-cyan-400/85",
  },
  {
    href: "/images",
    label: "Image Generation",
    icon: Wand2,
    iconBg: "bg-fuchsia-500/22",
    iconColor: "text-fuchsia-300",
    activeBg: "bg-fuchsia-500/32",
    ringColor: "ring-fuchsia-400/28",
    accent: "bg-fuchsia-400/85",
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: Users,
    iconBg: "bg-indigo-500/22",
    iconColor: "text-indigo-300",
    activeBg: "bg-indigo-500/32",
    ringColor: "ring-indigo-400/28",
    accent: "bg-indigo-400/85",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    iconBg: "bg-slate-500/20",
    iconColor: "text-slate-300",
    activeBg: "bg-slate-500/30",
    ringColor: "ring-slate-400/22",
    accent: "bg-slate-400/75",
  },
];

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-[13.5px] transition-all duration-200",
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
        ringColor={item.ringColor}
        active={active}
        variant="outline"
        size="md"
      />
      <span className="truncate leading-snug">{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { state, logout } = useApp();

  return (
    <aside className="hidden lg:flex flex-col w-[19rem] shrink-0 p-3 h-screen sticky top-0">
      <div className="glass-panel-strong flex flex-col flex-1 rounded-3xl overflow-hidden text-ink">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <span className="app-logo-badge icon-badge icon-badge-soft icon-badge-soft-active flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/95 to-indigo-600/90 ring-1 ring-white/20 shrink-0">
              <Icon icon={Sparkles} size="xl" className="text-amber-100" active />
            </span>
            <div className="min-w-0">
              <h1 className="text-ink font-semibold text-[15px] tracking-wide">Alexa</h1>
              <p className="text-ink-muted text-[11px] tracking-wide leading-snug">executive assistance</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        <div className="p-3.5 m-2.5 mt-0 rounded-2xl bg-black/25 ring-1 ring-white/10">
          <div className="flex items-start gap-3 px-0.5 py-0.5">
            <Avatar name={state?.user?.name || "Kash"} size="sm" />
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-sm font-medium text-ink leading-tight">{state?.user?.name || "Kash"}</p>
              <p className="text-[10.5px] text-ink-muted leading-snug mt-1">
                {state?.user?.role || "Founder & President"}
              </p>
            </div>
            <button
              onClick={logout}
              className="text-ink-muted hover:text-rose-300 transition-colors p-1 shrink-0 mt-0.5"
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
      <header className="lg:hidden sticky top-0 z-40 safe-area-top px-3 pt-2 pb-1.5">
        <div className="mobile-ios-bar flex items-center justify-between gap-3 px-3.5 h-[3.35rem]">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="icon-badge icon-badge-soft icon-badge-soft-active flex h-10 w-10 items-center justify-center rounded-[0.85rem] bg-gradient-to-br from-violet-500/95 to-indigo-600/90 ring-1 ring-white/20 shrink-0">
              <Icon icon={Sparkles} size="lg" className="text-amber-100" active />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-ink font-semibold text-[15px] leading-tight tracking-tight">Alexa</p>
              <p className="text-ink-muted text-xs truncate leading-tight mt-0.5 font-medium">
                {active?.label ?? "executive assistance"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="mobile-ios-menu-btn flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
          >
            <Icon icon={Menu} size="lg" className="text-ink-secondary" />
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
            "absolute top-0 right-0 h-full w-[min(20rem,92vw)] glass-panel-strong text-ink flex flex-col shadow-elevated transition-transform duration-300 safe-area-top",
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

          <div className="p-3.5 border-t border-white/10 flex-shrink-0 safe-area-bottom">
            <div className="flex items-start gap-3">
              <Avatar name={state?.user?.name || "Kash"} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink leading-tight">{state?.user?.name || "Kash"}</p>
                <p className="text-[10.5px] text-ink-muted leading-snug mt-1">
                  {state?.user?.role || "Founder & President"}
                </p>
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
  compact,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3",
        compact ? "mb-0" : "mb-5"
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            "font-display font-semibold text-ink tracking-tight",
            compact ? "text-lg" : "text-2xl sm:text-[1.65rem]"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-ink-muted mt-0.5 sm:mt-1 text-xs sm:text-sm">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
