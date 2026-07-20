import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store/app-context";
import { SplashOverlay } from "@/components/layout/SplashOverlay";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
});

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
  themeColor: "#2a3444",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="futuristic" className={inter.variable}>
      <body className={inter.className}>
        <AppProvider>
          <SplashOverlay />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
