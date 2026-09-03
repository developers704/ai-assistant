"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Visual surface for nested filters/tables. Default stays Athena dark. */
export type SurfaceTone = "dark" | "light";

const SurfaceToneContext = createContext<SurfaceTone>("dark");

export function SurfaceToneProvider({
  tone,
  children,
}: {
  tone: SurfaceTone;
  children: ReactNode;
}) {
  return <SurfaceToneContext.Provider value={tone}>{children}</SurfaceToneContext.Provider>;
}

export function useSurfaceTone(): SurfaceTone {
  return useContext(SurfaceToneContext);
}
