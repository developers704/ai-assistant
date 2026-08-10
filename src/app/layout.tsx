import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store/app-context";
import { SplashOverlay } from "@/components/layout/SplashOverlay";
import { DocumentTitle } from "@/components/layout/DocumentTitle";
import { APP_NAME, APP_NAME_SHORT, APP_TAGLINE, APP_TITLE } from "@/lib/brand";

/**
 * Avoid next/font/google — VPS builds often time out fetching Google Fonts
 * (ETIMEDOUT on Inter). System UI stack keeps offline/CI builds reliable.
 */

export const metadata: Metadata = {
  // absolute: prevent parent/template from concatenating old + new titles
  title: {
    default: APP_TITLE,
    absolute: APP_TITLE,
  },
  description: `${APP_NAME} — ${APP_TAGLINE}`,
  manifest: "/manifest.json",
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME_SHORT,
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
      <body className="font-sans antialiased">
        <AppProvider>
          <DocumentTitle />
          <SplashOverlay />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
