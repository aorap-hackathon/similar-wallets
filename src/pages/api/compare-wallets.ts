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

  const { wallet1, wallet2 } = req.body;

  if (!wallet1 || !wallet2) {
    return res.status(400).json({ message: 'Both wallet addresses are required' });
  }

  try {
    const wallet1Txs = await getAddressTransactions(wallet1);
    console.log("wallet1Txs:", wallet1Txs.length)
    const wallet2Txs = await getAddressTransactions(wallet2);
    console.log("wallet2Txs:", wallet2Txs.length)

    const similarTransactions = findSimilarTransactions(wallet1Txs, wallet2Txs);
    console.log("similarTxs:", similarTransactions.length);

    res.status(200).json({ similarTransactions });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function getAddressTransactions(address: string): Promise<Transaction[]> {
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
        Math.abs(parseInt(tx1.timeStamp, 16) - parseInt(tx2.timeStamp, 16)) <= 60 // Within 1 minute
      ) {
        similarTxs.push({
          wallet1Tx: tx1,
          wallet2Tx: tx2,
          contractAddress: tx1.to,
          timestamp: parseInt(tx1.timeStamp, 16),
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

function formatTransaction(tx: SimilarTransaction): string {
  const date = new Date(tx.timestamp * 1000).toISOString();
  const valueInEther1 = parseInt(tx.wallet1Tx.value, 16) / 1e26;
  const valueInEther2 = parseInt(tx.wallet2Tx.value, 16) / 1e26;
  return `
    Time: ${date}
    Contract: ${tx.contractAddress}
    Method 1: ${tx.wallet1Tx.input.slice(0, 10)}
    Method 2: ${tx.wallet2Tx.input.slice(0, 10)}
    Value 1: ${valueInEther1} ETH
    Value 2: ${valueInEther2} ETH
    Wallet 1 Tx: ${tx.wallet1Tx.hash}
    Wallet 2 Tx: ${tx.wallet2Tx.hash}
  `;
}