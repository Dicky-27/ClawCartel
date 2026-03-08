import { TooltipProvider } from "./_components/ui/tooltip";
import { AgentsProvider } from "./_providers/AgentsProvider";
import { AuthProvider } from "./_providers/AuthProvider";
import { ChatProvider } from "./_providers/ChatProvider";
import { QueryProvider } from "./_providers/QueryProvider";
import { SolanaProvider } from "./_providers/SolanaProvider";
import { ThemeProvider } from "./_providers/ThemeProvider";

function composeProviders(providers: React.ComponentType<{ children: React.ReactNode }>[]) {
  return ({ children }: { children: React.ReactNode }) => {
    return providers.reduceRight((acc, Provider) => {
      return <Provider>{acc}</Provider>;
    }, children);
  };
}

const AppProviders = composeProviders([
  QueryProvider,
  ThemeProvider,
  SolanaProvider,
  AuthProvider,
  TooltipProvider,
  AgentsProvider,
  ChatProvider,
]);

export function Providers({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
