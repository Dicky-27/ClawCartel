import { Metadata, Viewport } from "next";
import "../styles/index.css";
import { AppHeader } from "./_components/AppHeader";
import { GlobalLoadingGate } from "./_components/GlobalLoadingGate";
import { WalletConnectDialog } from "./_components/ui/WalletConnectDialog";
import WelcomeDialog from "./_components/dialogs/WelcomeDialog";
import { Providers } from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#222226",
};

export const metadata: Metadata = {
  title: "Claw Cartel",
  description: "AgentClaw Cartel (CC) is a collaborative AI workspace.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Claw Cartel",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark h-full">
      <head />
      <body className="h-full min-h-screen-dvh font-sans" suppressHydrationWarning>
        <Providers>
          <GlobalLoadingGate>
            <div className="flex h-full min-h-screen-dvh flex-col">
              <AppHeader />
              <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
              <WalletConnectDialog />
              <WelcomeDialog />
            </div>
          </GlobalLoadingGate>
        </Providers>
      </body>
    </html>
  );
}
