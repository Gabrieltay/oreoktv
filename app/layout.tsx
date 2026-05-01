import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { TabBar } from "@/components/tab-bar";
import { PlaybackBar } from "@/components/playback-bar";
import { Toaster } from "@/components/toaster";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/theme-provider";
import { RuntimeConfigProvider } from "@/components/runtime-config";
import { getKtvBaseUrl, imageBaseFor } from "@/lib/server-config";

export const metadata: Metadata = {
  title: "Oreo KTV",
  description: "KTV remote control",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ktvBaseUrl = await getKtvBaseUrl();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <RuntimeConfigProvider value={{ imageBase: imageBaseFor(ktvBaseUrl) }}>
            <QueryProvider>
              <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col">
                <TabBar />
                <main className="flex flex-1 flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
                  {children}
                </main>
              </div>
              <PlaybackBar />
              <Toaster />
            </QueryProvider>
          </RuntimeConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
