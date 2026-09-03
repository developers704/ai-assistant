"use client";

import "@/app/hr-theme.css";
import { SurfaceToneProvider } from "@/components/ui/surface-tone";
import { cn } from "@/lib/utils";

export function HrWorkspace({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SurfaceToneProvider tone="light">
      <div className={cn("hr-workspace -mx-3 sm:-mx-5 lg:-mx-6 -my-4 lg:-my-6", className)}>
        <div className="hr-page">{children}</div>
      </div>
    </SurfaceToneProvider>
  );
}
