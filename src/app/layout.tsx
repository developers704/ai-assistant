import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store/app-context";

export const metadata: Metadata = {
  title: "Alexa — executive assistance",
  description: "Your private AI executive assistant for business owners",
  manifest: "/manifest.json",
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
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
