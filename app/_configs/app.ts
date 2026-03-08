export const APP_CONFIG = {
  api_url: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  token_storage_key: process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY ?? "token",
  environment: (process.env.NEXT_PUBLIC_ENVIRONMENT ?? "devnet") as "mainnet" | "devnet",
  solana_rpc_endpoint:
    process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT ?? "https://api.devnet.solana.com",
  socket_url: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3000",
};
