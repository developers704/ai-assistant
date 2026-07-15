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

/** Detect installed PWA before paint so we don't flash a second splash on mobile. */
const PWA_BOOT_SCRIPT = `(function(){try{var s=window.matchMedia&&(window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: fullscreen)").matches||window.matchMedia("(display-mode: minimal-ui)").matches);var ios=!!(window.navigator&&window.navigator.standalone);document.documentElement.dataset.pwa=(s||ios)?"1":"0";}catch(e){document.documentElement.dataset.pwa="0";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="futuristic">
      <head>
        <script dangerouslySetInnerHTML={{ __html: PWA_BOOT_SCRIPT }} />
      </head>
      <body>
        <AppProvider>
          <SplashOverlay />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
