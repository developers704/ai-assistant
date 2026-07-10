"use client";

import {
  ExternalLink,
  Globe,
  Instagram,
  ShoppingBag,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "@/components/layout/PageShell";

export type CompanyLink = {
  id: string;
  label: string;
  description: string;
  href: string;
  displayUrl: string;
  icon: LucideIcon;
  accent: string;
};

/** Official Valliani company & brand destinations for quick open. */
export const COMPANY_LINKS: CompanyLink[] = [
  {
    id: "website",
    label: "Company website",
    description: "Valliani Jewelers official site",
    href: "https://vallianijewelers.com/",
    displayUrl: "vallianijewelers.com",
    icon: Globe,
    accent: "from-amber-500/20 to-amber-500/5 text-amber-200 ring-amber-400/25",
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "@vallianijewelers",
    href: "https://www.instagram.com/vallianijewelers/",
    displayUrl: "instagram.com/vallianijewelers",
    icon: Instagram,
    accent: "from-fuchsia-500/20 to-rose-500/5 text-fuchsia-200 ring-fuchsia-400/25",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Valliani online marketplace",
    href: "https://vallianimarketplace.com/en",
    displayUrl: "vallianimarketplace.com",
    icon: ShoppingBag,
    accent: "from-sky-500/20 to-cyan-500/5 text-sky-200 ring-sky-400/25",
  },
  {
    id: "linknlock",
    label: "Link n Lock",
    description: "Link n Lock brand site",
    href: "https://linknlock.com/",
    displayUrl: "linknlock.com",
    icon: Lock,
    accent: "from-emerald-500/20 to-teal-500/5 text-emerald-200 ring-emerald-400/25",
  },
];

export function CompanyLinksSection() {
  return (
    <section className="mb-5">
      <SectionHeading
        title="Company & brand links"
        icon={Globe}
        iconClass="bg-amber-500/12 text-amber-300"
      />
      <p className="text-xs text-ink-muted -mt-1 mb-3">
        Open official websites and social accounts in a new tab.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {COMPANY_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-2xl ring-1 ring-white/[0.08] bg-white/[0.03] p-4 hover:bg-white/[0.06] hover:ring-white/[0.14] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${link.accent}`}
              >
                <Icon size={18} strokeWidth={1.85} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-ink truncate">{link.label}</p>
                  <ExternalLink
                    size={12}
                    className="text-white/25 group-hover:text-white/55 shrink-0 transition-colors"
                  />
                </div>
                <p className="text-xs text-ink-secondary mt-0.5 truncate">{link.description}</p>
                <p className="text-[11px] font-mono text-white/35 mt-1.5 truncate group-hover:text-white/50 transition-colors">
                  {link.displayUrl}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
