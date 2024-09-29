import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import {SCROLLSCAN_API_KEY, SCROLLSCAN_API_URL, ALCHEMY_API_URL} from "./wallet";

export interface Transaction {
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  hash: string;
  value: string;
  input: string;
}

export interface SimilarTransaction {
  wallet1Tx: Transaction;
  wallet2Tx: Transaction;
  contractAddress: string;
  timestamp: number;
  value: string;
  methodSignature: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  let { wallet1, wallet2 } = req.body;

  if (!wallet1 || !wallet2) {
    return res.status(400).json({ message: 'Both wallet addresses are required' });
  }


  try {
    const similarTransactions = await compareWallets(wallet1, wallet2);

    res.status(200).json({ similarTransactions });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

export async function compareWallets(wallet1: string, wallet2: string): Promise<SimilarTransaction[]> {
    wallet1 = wallet1.toLowerCase();
    wallet2 = wallet2.toLowerCase();

    const wallet1Txs = await getAddressTransactions(wallet1);
    const wallet2Txs = await getAddressTransactions(wallet2);

    const similarTransactions = findSimilarTransactions(wallet1Txs, wallet2Txs);

    console.log("comparing:", wallet1, "and", wallet2, "wallet1Txs:", wallet1Txs.length, "wallet2Txs:", wallet2Txs.length, "similarTxs:", similarTransactions.length);
    
    return similarTransactions;
}

let lastRequestTime = 0; // Store the time of the last request
const requestDelay = 1000; // 1 second in milliseconds

async function getAddressTransactions(address: string): Promise<Transaction[]> {
    const currentTime = Date.now();

    // Calculate the time since the last request
    const timeSinceLastRequest = currentTime - lastRequestTime;

    // If the time since the last request is less than the delay, wait
    if (timeSinceLastRequest < requestDelay) {
        await new Promise(resolve => setTimeout(resolve, requestDelay - timeSinceLastRequest));
    }

    // Now we can make the request
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

    // Update the last request time to now
    lastRequestTime = Date.now();

    return transactions;
}


function findSimilarTransactions(wallet1Txs: Transaction[], wallet2Txs: Transaction[]): SimilarTransaction[] {
  const similarTxs: SimilarTransaction[] = [];
  const usedTx: { [key: string]: boolean } = {}; // Use a map of string to boolean

  for (const tx1 of wallet1Txs) {
    for (const tx2 of wallet2Txs) {
      if (
        tx1.to === tx2.to &&
        !usedTx[tx2.hash] &&
        Math.abs(parseInt(tx1.timeStamp) - parseInt(tx2.timeStamp)) <= 60 // Within 1 minute
      ) {
        similarTxs.push({
          wallet1Tx: tx1,
          wallet2Tx: tx2,
          contractAddress: tx1.to,
          timestamp: parseInt(tx1.timeStamp),
          value: tx1.value,
          methodSignature: tx1.input.slice(0, 10) // First 4 bytes of the input data
        });
        usedTx[tx2.hash] = true;
        break;
      }
    }
  }

  return similarTxs.sort((a, b) => a.timestamp - b.timestamp);
}
