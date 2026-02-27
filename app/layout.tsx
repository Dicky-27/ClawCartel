import "../styles/index.css";
import { AppHeader } from "./_components/AppHeader";
import { GlobalLoadingGate } from "./_components/GlobalLoadingGate";
import { WalletConnectDialog } from "./_components/ui/WalletConnectDialog";
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
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
