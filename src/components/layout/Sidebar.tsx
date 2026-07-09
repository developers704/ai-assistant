"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
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
  Instagram,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/lib/store/app-context";
import { Avatar } from "@/components/ui/Avatar";
import { PlasmaOrb } from "@/components/ui/PlasmaOrb";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Vivid gradient for the 3D glass tile */
  tile: string;
  accent: string;
};

const navItems: NavItem[] = [
  {
    href: "/chat",
    label: "AI Chat",
    icon: MessageSquare,
    tile: "from-violet-400 via-violet-500 to-indigo-600",
    accent: "bg-violet-400/85",
  },
  {
    href: "/dashboard",
    label: "Daily Briefing",
    icon: Sun,
    tile: "from-amber-300 via-orange-400 to-orange-600",
    accent: "bg-amber-400/85",
  },
  {
    href: "/news",
    label: "News & Markets",
    icon: Newspaper,
    tile: "from-sky-300 via-sky-500 to-blue-600",
    accent: "bg-sky-400/85",
  },
  {
    href: "/email",
    label: "Email",
    icon: Mail,
    tile: "from-blue-400 via-blue-500 to-indigo-700",
    accent: "bg-blue-400/85",
  },
  {
    href: "/calendar",
    label: "Calendar & Tasks",
    icon: Calendar,
    tile: "from-rose-400 via-rose-500 to-pink-700",
    accent: "bg-rose-400/85",
  },
  {
    href: "/sales",
    label: "Sales Dashboard",
    icon: BarChart3,
    tile: "from-emerald-300 via-emerald-500 to-teal-700",
    accent: "bg-emerald-400/85",
  },
  {
    href: "/calculator",
    label: "Price Calculator",
    icon: Calculator,
    tile: "from-yellow-300 via-amber-400 to-amber-600",
    accent: "bg-yellow-400/85",
  },
  {
    href: "/analyst",
    label: "Data Analyst",
    icon: Database,
    tile: "from-cyan-300 via-cyan-500 to-sky-700",
    accent: "bg-cyan-400/85",
  },
  {
    href: "/images",
    label: "Image Generation",
    icon: Wand2,
    tile: "from-fuchsia-400 via-fuchsia-500 to-purple-700",
    accent: "bg-fuchsia-400/85",
  },
  {
    href: "/social",
    label: "Social",
    icon: Instagram,
    tile: "from-pink-400 via-rose-500 to-fuchsia-700",
    accent: "bg-pink-400/85",
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: Users,
    tile: "from-indigo-300 via-indigo-500 to-violet-700",
    accent: "bg-indigo-400/85",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    tile: "from-slate-400 via-slate-500 to-slate-700",
    accent: "bg-slate-400/75",
  },
];

function NavTile({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <span
      className={cn(
        "icon-tile flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br ring-1 ring-white/10",
        item.tile,
        active ? "icon-tile-active" : "icon-tile-dim"
      )}
    >
      <Icon icon={item.icon} size="sm" className="text-white" />
    </span>
  );
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3.5 px-3 py-2 rounded-[14px] text-[13.5px] transition-all duration-200",
        active
          ? "nav-pill-active text-white font-semibold"
          : "text-ink-secondary font-medium hover:text-white hover:bg-white/5"
      )}
    >
      <NavTile item={item} active={active} />
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
            <PlasmaOrb className="h-12 w-12 shrink-0">
              <Icon icon={Sparkles} size="lg" className="text-white drop-shadow" active />
            </PlasmaOrb>
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
      <header className="lg:hidden sticky top-0 z-40 mobile-nav-safe px-3 pb-2">
        <div className="mobile-ios-bar flex items-center justify-between gap-3 px-3.5 h-[3.25rem]">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <PlasmaOrb className="h-10 w-10 shrink-0">
              <Icon icon={Sparkles} size="md" className="text-white drop-shadow" active />
            </PlasmaOrb>
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

export { PageHeader } from "@/components/layout/PageShell";
