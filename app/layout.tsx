import { Metadata } from "next";
import "../styles/index.css";
import { AppHeader } from "./_components/AppHeader";
import { GlobalLoadingGate } from "./_components/GlobalLoadingGate";
import { WalletConnectDialog } from "./_components/ui/WalletConnectDialog";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Claw Cartel",
  description: "AgentClaw Cartel (CC) is a collaborative AI workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="Claw Cartel" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className="h-full min-h-screen" suppressHydrationWarning>
        <Providers>
          <GlobalLoadingGate>
            <div className="flex h-full min-h-screen flex-col">
              <AppHeader />
              <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
              <WalletConnectDialog />
            </div>
          </GlobalLoadingGate>
        </Providers>
      </body>
    </html>
  );
}
