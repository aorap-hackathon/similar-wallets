import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import {
  scroll
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Similar Wallets',
  projectId: 'a0423bd4d5dfb377c736fc030a4b2f93',
  chains: [
    scroll
  ],
  transports: {
    [scroll.id]: http(`https://scroll-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
  },
  ssr: true,
});