import { ExampleProviders } from "./_providers/ExampleProviders";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ExampleProviders>{children}</ExampleProviders>;
}