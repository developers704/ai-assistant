import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store/app-context";
import { SplashDismiss } from "@/components/layout/SplashDismiss";

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
        <div
          id="static-app-splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1e2733] transition-opacity duration-300"
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "linear-gradient(145deg, #7c3aed 0%, #4338ca 55%, #312e81 100%)",
              boxShadow: "0 4px 24px rgba(109, 40, 217, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3l1.2 3.5 3.5 1.2-3.5 1.2L12 12.4l-1.2-3.5-3.5-1.2 3.5-1.2L12 3z"
                fill="#FBBF24"
              />
              <path d="M5 9l.8 2.2 2.2.8-2.2.8L5 15l-.8-2.2-2.2-.8 2.2-.8L5 9z" fill="#FEF3C7" />
              <path d="M19 9l.8 2.2 2.2.8-2.2.8L19 15l-.8-2.2-2.2-.8 2.2-.8L19 9z" fill="#FEF3C7" />
            </svg>
          </div>
          <p
            style={{
              marginTop: 20,
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              background: "linear-gradient(90deg, #f8fafc 0%, #fde68a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Alexa
          </p>
          <p
            style={{
              marginTop: 6,
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(148, 163, 184, 0.9)",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            executive assistance
          </p>
        </div>
        <AppProvider>
          <SplashDismiss />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
