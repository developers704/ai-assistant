"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import {
  MessageSquare,
  Mail,
  Calendar,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Database,
  Wand2,
  Newspaper,
  Calculator,
  MapPinned,
  Instagram,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/lib/store/app-context";
import { Avatar } from "@/components/ui/Avatar";
import { PlasmaOrb } from "@/components/ui/PlasmaOrb";
import { GlassIconTile, type GlassPalette } from "@/components/ui/GlassIconTile";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  palette: GlassPalette;
};

const navItems: NavItem[] = [
  { href: "/chat", label: "AI Chat", icon: MessageSquare, palette: "violet" },
  { href: "/news", label: "News & Markets", icon: Newspaper, palette: "sky" },
  { href: "/email", label: "Email", icon: Mail, palette: "indigo" },
  { href: "/calendar", label: "Calendar & Tasks", icon: Calendar, palette: "rose" },
  { href: "/sales", label: "Sales Dashboard", icon: BarChart3, palette: "emerald" },
  { href: "/stores", label: "Stores Map & Info", icon: MapPinned, palette: "violet" },
  { href: "/calculator", label: "Price Calculator", icon: Calculator, palette: "amber" },
  { href: "/analyst", label: "Data Analyst", icon: Database, palette: "cyan" },
  { href: "/images", label: "Image Generation", icon: Wand2, palette: "fuchsia" },
  { href: "/social", label: "Social", icon: Instagram, palette: "rose" },
  { href: "/contacts", label: "Contacts", icon: Users, palette: "indigo" },
  { href: "/settings", label: "Settings", icon: Settings, palette: "slate" },
];

function NavTile({ item, active }: { item: NavItem; active: boolean }) {
  return <GlassIconTile icon={item.icon} palette={item.palette} active={active} size="sm" />;
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
            <PlasmaOrb density="low" className="h-12 w-12 shrink-0" />
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
            <PlasmaOrb density="low" className="h-10 w-10 shrink-0" />
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
