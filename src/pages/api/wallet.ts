import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export const SCROLLSCAN_API_KEY = process.env.SCROLLSCAN_API_KEY
export const SCROLLSCAN_API_URL = 'https://api.scrollscan.com/api';
export const ALCHEMY_API_URL = `https://scroll-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

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
  console.log("JOOOOOOOOOOOPAAAAAAA")
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
    const usedTx: { [key: string]: boolean } = {}; // Use a map of string to boolean
    console.log(transactions)
    const initSimilarWallets: { [key: string]: number } = {};

    let debugcnt = 0;
    for (const tx of transactions) {
      const blockNumber = parseInt(tx.blockNumber);
      const timestamp = parseInt(tx.timeStamp);

      const adjacentTransactions = await getAdjacentTransactions(blockNumber, timestamp);
      console.log("Block number:", blockNumber, "transactions length:", adjacentTransactions.length);

      for (const adjTx of adjacentTransactions) {
        if (adjTx.to === tx.to && adjTx.from !== address && !usedTx[adjTx.hash]) {
            initSimilarWallets[adjTx.from] = (initSimilarWallets[adjTx.from] || 0) + 1;
            usedTx[adjTx.hash] = true;
            break;
        }
      }

      debugcnt++;
    }

    console.log(initSimilarWallets);
    // res.status(200).json({ similarWallets });

    const similarWallets = Object.entries(initSimilarWallets)
      .filter(([, value]) => value >= 10) // Filter out keys with values < 10
      .sort(([, valueA], [, valueB]) => valueB - valueA) // Sort by values in descending order
      .reduce<{ [key: string]: number }>((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});

    console.log(similarWallets);

    res.status(200).json({ similarWallets });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function getAdjacentTransactions(blockNumber: number, timestamp: number): Promise<Transaction[]> {
    const lowerBlock = Math.max(0, blockNumber - 30);
    const upperBlock = blockNumber + 30;
  
    const blockNumbersToFetch = [];
  
    for (let i = blockNumber; i <= upperBlock; i++) {
      blockNumbersToFetch.push(i);
    }
  
    for (let i = blockNumber - 1; i >= lowerBlock; i--) {
      blockNumbersToFetch.push(i);
    }
  
    // Function to delay execution
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
    const blocks: (Block | null)[] = [];
    const requestsPerBatch = 30; // Maximum requests per second
    const delayPerRequest = 1000 / requestsPerBatch; // Delay between requests in ms
  
    // Fetch blocks in batches
    for (let i = 0; i < blockNumbersToFetch.length; i += requestsPerBatch) {
      const batch = blockNumbersToFetch.slice(i, i + requestsPerBatch);
  
      const results = await Promise.all(
        batch.map(async (blockNumber) => {
          try {
            return await getBlockByNumber(blockNumber);
          } catch (error) {
            console.error(`Failed to fetch block ${blockNumber}`, error);
            return null; // Return null if a block fails to be fetched
          }
        })
      );
  
      blocks.push(...results); // Add the results to the blocks array
  
      // Delay to respect rate limit, except for the last batch
      if (i + requestsPerBatch < blockNumbersToFetch.length) {
        await delay(1000); // Wait for 1 second before the next batch
      }
    }
  
    // Filter out any blocks that were null (i.e., failed to fetch)
    const adjacentTransactions: Transaction[] = blocks
      .filter((block): block is Block => block !== null) // TypeScript type narrowing
      .filter(block => Math.abs(parseInt(block.timestamp, 16) - timestamp) <= 60) // Within 1 minute
      .flatMap(block => block.transactions);
  
    return adjacentTransactions;
  }
  
  
  async function getBlockByNumber(blockNumber: number): Promise<Block | null> {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBlockByNumber',
      params: [`0x${blockNumber.toString(16)}`, true],
    };
  
    try {
      const response = await axios.post(ALCHEMY_API_URL, payload);
      return response.data.result;
    } catch (error) {
      return null; // Return null if an error occurs
    }
  }
  