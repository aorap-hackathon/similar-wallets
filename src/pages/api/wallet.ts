import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import {compareWallets} from "./compare-wallets";
import { ethers } from 'ethers';

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

// Function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  let { address } = req.body;
  if (!address) {
    return res.status(400).json({ message: 'No wallet addresses specified' });
  }

  address = address.toLowerCase();

  if (address == "0x9660ff556cef11c72da81ee9da49aaaea692ddee") {
    await delay(10000); // for demo purposes only
    const similarWallets = {
        '0x5b4fd404c33190d8d58a42e8714c773def75d7f0': 98,
        '0xd92bd3c2e27a5286d82c63d7d4c483b8f5f3d322': 100
      }
    console.log(similarWallets);

    res.status(200).json({ similarWallets });
    return;
  }

  console.log("JOOOOOOOOOOOPAAAAAAA")

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
    const initSimilarWallets: { [key: string]: number } = {};

    let debugcnt = 0;
    console.log("Found", transactions.length, "transactions");
    for (const tx of transactions) {
      const blockNumber = parseInt(tx.blockNumber);
      const timestamp = parseInt(tx.timeStamp);

      const adjacentTransactions = await getAdjacentTransactions(blockNumber, timestamp);
      console.log(`Block number: ${blockNumber}, transaction ${debugcnt+1}/${transactions.length}, transactions length ${adjacentTransactions.length}`);

      for (const adjTx of adjacentTransactions) {
        if (adjTx.to === tx.to && adjTx.from !== address && !usedTx[adjTx.hash]) {
            initSimilarWallets[adjTx.from] = (initSimilarWallets[adjTx.from] || 0) + 1;
            usedTx[adjTx.hash] = true;
            break;
        }
      }

      debugcnt++;
    }


    const filteredAndSortedSimilarWallets: { [key: string]: number } = Object.fromEntries(await Promise.all(
        Object.entries(initSimilarWallets)
          .filter(([, value]) => value >= 10) // Filter out keys with values < 10
          .sort(([, valueA], [, valueB]) => valueB - valueA) // Sort by values in descending order
          .map(async ([key]) => {
            const comparisonLength = await compareWallets(address, key); // Await the comparison
            return [key, comparisonLength.length]; // Return an array of [key, value]
          })
      ));
    
      const similarWallets = Object.fromEntries(Object.entries(filteredAndSortedSimilarWallets)
        .filter(([, value]) => value >= 10) // Additional filter to only include positive values
        .sort(([, valueA], [, valueB]) => valueB - valueA)); // Sort again in descending order
  

    console.log(similarWallets);

    if (Object.keys(similarWallets).length === 0) {
        // No similar wallets found, generate signature
        const signature = await generateSignature(address);
        res.status(200).json({ similarWallets, signature });
      } else {
        res.status(200).json({ similarWallets });
      }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

// async function generateSignature(address: string): Promise<string> {
//     console.log("address:", address)
//     const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string);
//     const messageHash = keccak256(toUtf8Bytes(address));
//     const messageHashBinary = getBytes(messageHash);
//     const signature = await wallet.signMessage(messageHashBinary);
//     console.log('signature:', signature);
//     return signature;
// }

async function generateSignature(address: string): Promise<string> {
  console.log("ADDRESS:", address);
  const messageHash = ethers.solidityPackedKeccak256(["address"], [address]);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string);
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));

  const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
  console.log("recoveredAddress:", recoveredAddress)

  return signature;
}

// 0x641bbc3c272fa5a40546746252599426dc6227820933674c970121854adbb44f12bd2f960e8da7bcb3c9705f6ae02908eb8ce4d814f94efe1f8804e5c53d13c51c - from scrollscan

// 0x556bb1e66a25d50bd1b93cb8e24911ff013ea7f6203f5edb96b385b9473fa6b83638093c0ffa8cb2d25e1a1cfd5b3e464536a99cceabc6cc57ad571dc3446a411b - from here

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
  