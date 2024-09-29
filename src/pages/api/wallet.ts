import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const SCROLLSCAN_API_KEY = process.env.SCROLLSCAN_API_KEY
const SCROLLSCAN_API_URL = 'https://api.scrollscan.com/api';
const ALCHEMY_API_URL = `https://scroll-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

interface Transaction {
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  hash: string;
}

interface Block {
  timestamp: string;
  transactions: Transaction[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { address } = req.body;

  try {
    const response = await axios.get(SCROLLSCAN_API_URL, {
      params: {
        module: 'account',
        action: 'txlist',
        address,
        startblock: 0,
        endblock: 99999999,
        sort: 'asc',
        apikey: SCROLLSCAN_API_KEY,
      },
    });

    const transactions: Transaction[] = response.data.result;
    const similarWallets: { [key: string]: number } = {};

    for (const tx of transactions) {
      const blockNumber = parseInt(tx.blockNumber);
      const timestamp = parseInt(tx.timeStamp);

      const adjacentTransactions = await getAdjacentTransactions(blockNumber, timestamp);

      for (const adjTx of adjacentTransactions) {
        if (adjTx.to === tx.to && adjTx.from !== address) {
          similarWallets[adjTx.from] = (similarWallets[adjTx.from] || 0) + 1;
        }
      }
    }

    res.status(200).json({ similarWallets });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function getAdjacentTransactions(blockNumber: number, timestamp: number): Promise<Transaction[]> {
    const lowerBlock = Math.max(0, blockNumber - 10);
    const upperBlock = blockNumber + 10;
    const adjacentTransactions: Transaction[] = [];
  
    for (let i = lowerBlock; i <= upperBlock; i++) {
      const block = await getBlockByNumber(i);
      if (Math.abs(parseInt(block.timestamp, 16) - timestamp) <= 120) { // Within 2 minutes
        adjacentTransactions.push(...block.transactions);
      }
    }
  
    return adjacentTransactions;
  }
  
  async function getBlockByNumber(blockNumber: number): Promise<Block> {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBlockByNumber',
      params: [`0x${blockNumber.toString(16)}`, true]
    };
  
    const response = await axios.post(ALCHEMY_API_URL, payload);
    return response.data.result;
  }