import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Sidebar } from "@/components/nav/Sidebar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ThemedToaster } from "@/components/ui/ThemedToaster";
import { DataProvider } from "@/contexts/DataProvider";
import TeamDockMount from "@/components/team/TeamDockMount";
import TopRightPanelMount from "@/components/nav/TopRightPanelMount";
import { StageTaskTrayController } from "@/components/tasks/StageTaskTrayController";
import { QuickAddTaskOverlay } from "@/components/tasks/QuickAddTaskOverlay";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const isStaticExport = process.env.STATIC_EXPORT === "1";

export const metadata: Metadata = {
  title: "Centurion CRM",
  description: "Deal pipeline and document workspace for Centurion.",
  // Static export needs the basePath baked into asset URLs since the App
  // Router's auto-favicon doesn't always prefix correctly under output:'export'.
  ...(isStaticExport ? { icons: { icon: "/CenturionCRM/favicon.ico" } } : {}),
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* SPA redirect handler. Pairs with scripts/inject-spa-redirect.mjs
          (postbuild) and public/spa-redirect.js (served as a static asset).
          Only loaded in static-export builds — in local dev the script
          wouldn't fire anyway since there's no 404→index redirect happening.
          `beforeInteractive` guarantees load+execute before hydration so the
          URL is corrected before Next's client router picks up the route. */}
      {isStaticExport && (
        <Script
          src="/CenturionCRM/spa-redirect.js"
          strategy="beforeInteractive"
        />
      )}
      <body className="min-h-full">
        <ThemeProvider>
          <DataProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 min-w-0">{children}</main>
            </div>
            <TeamDockMount />
            <TopRightPanelMount />
            <StageTaskTrayController />
            <QuickAddTaskOverlay />
          </DataProvider>
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
