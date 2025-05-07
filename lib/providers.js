"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { farcasterFrame as miniAppConnector } from "@farcaster/frame-wagmi-connector";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  rainbowWallet,
  metaMaskWallet,
  injectedWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";

const connectors = connectorsForWallets(
    [
      {
        groupName: "Recommended",
        wallets: [rainbowWallet, coinbaseWallet, metaMaskWallet, injectedWallet],
      },
    ],
    {
      appName: "Coincept",
      projectId: "YOUR_PROJECT_ID",
    }
  );
  
  export const config = createConfig({
    chains: [base],
    transports: {
      [base.id]: http("https://base-mainnet.g.alchemy.com/v2/rgLw9ASxDjV4MABUX8q3jYH8rQg1vYTj"),
    },
    connectors: [miniAppConnector(), ...connectors],
  });
  
  const queryClient = new QueryClient();
  

export default function Providers(props) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
            {props.children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}