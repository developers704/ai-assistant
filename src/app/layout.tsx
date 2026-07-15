import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store/app-context";
import { SplashOverlay } from "@/components/layout/SplashOverlay";

export const metadata: Metadata = {
  title: "Alexa — executive assistance",
  description: "Your private AI executive assistant for business owners",
  manifest: "/manifest.json",
  applicationName: "Alexa",
  appleWebApp: {
    capable: true,
    title: "Alexa",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1e2733",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="futuristic">
      <body>
        <AppProvider>
          <SplashOverlay />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
