"use client";

import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  keccak256,
  toUtf8Bytes,
} from "ethers";

export const GREENTRACE_CONTRACT_ADDRESS =
  "0x68C3Fa8f328D13B060E928C646dE523BF74a5034";

const SEPOLIA_CHAIN_ID = BigInt(11155111);
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

/**
 * Public Sepolia RPC used only for read-only blockchain verification.
 *
 * No MetaMask account or private key is required.
 * If this public endpoint is unavailable later, we can move the RPC
 * configuration to an environment variable.
 */
const SEPOLIA_PUBLIC_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

export const GREENTRACE_ABI = [
  "function recordBatch(string batchId, bytes32 dataHash)",
  "function verifyBatch(string batchId, bytes32 dataHash) view returns (bool)",
  "function batchHashes(string) view returns (bytes32)",
];

/**
 * Returns the GreenTrace contract connected to MetaMask.
 *
 * This is used for WRITE operations such as recordBatch().
 */
async function getWalletContract() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error(
      "MetaMask was not detected. Install or unlock the MetaMask extension.",
    );
  }

  const ethereum = window.ethereum;

  // Read the currently selected MetaMask network.
  const currentChainId = String(
    await ethereum.request({
      method: "eth_chainId",
    }),
  ).toLowerCase();

  // Ask MetaMask to switch to Sepolia if necessary.
  if (currentChainId !== SEPOLIA_CHAIN_ID_HEX) {
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: SEPOLIA_CHAIN_ID_HEX,
          },
        ],
      });
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code: number }).code
          : undefined;

      if (code === 4001) {
        throw new Error(
          "You rejected the network switch. Please select Sepolia in MetaMask and try again.",
        );
      }

      throw new Error(
        "Could not switch to Sepolia. Open MetaMask, select the Sepolia test network, and retry.",
      );
    }
  }

  // Create the provider only after the network is correct.
  const provider = new BrowserProvider(ethereum);

  const network = await provider.getNetwork();

  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Wrong network. Expected Sepolia (11155111), received chain ID ${network.chainId}.`,
    );
  }

  const signer = await provider.getSigner();

  return new Contract(GREENTRACE_CONTRACT_ADDRESS, GREENTRACE_ABI, signer);
}

/**
 * Returns a read-only GreenTrace contract.
 *
 * This does NOT use MetaMask.
 * Consumers can therefore verify a batch without connecting a wallet.
 */
function getReadOnlyContract() {
  const provider = new JsonRpcProvider(
    SEPOLIA_PUBLIC_RPC_URL,
    {
      chainId: 11155111,
      name: "sepolia",
    },
    {
      staticNetwork: true,
    },
  );

  return new Contract(GREENTRACE_CONTRACT_ADDRESS, GREENTRACE_ABI, provider);
}

/**
 * Creates the deterministic Keccak-256 hash used by GreenTrace.
 *
 * IMPORTANT:
 * JSON.stringify() preserves the insertion order of the object's
 * properties. Verification must therefore reconstruct the batch object
 * using the exact same fields and property order that were used when
 * the farmer originally registered the batch.
 */
export function createBatchHash(batchData: unknown): string {
  const json = JSON.stringify(batchData);

  if (json === undefined) {
    throw new Error("Invalid batch data: unable to serialize.");
  }

  return keccak256(toUtf8Bytes(json));
}

/**
 * Records a batch hash on the GreenTrace Sepolia contract.
 *
 * MetaMask is required because this is a blockchain WRITE operation.
 */
export async function recordBatchOnBlockchain(
  batchId: string,
  dataHash: string,
): Promise<{
  transactionHash: string;
  blockNumber: number;
}> {
  const cleanBatchId = batchId.trim();

  if (!cleanBatchId) {
    throw new Error("Batch ID is required.");
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(dataHash)) {
    throw new Error("Invalid data hash. Expected a 32-byte hexadecimal hash.");
  }

  const contract = await getWalletContract();

  const existingHash: string = await contract.batchHashes(cleanBatchId);

  const emptyHash = `0x${"0".repeat(64)}`;

  if (existingHash !== emptyHash) {
    throw new Error(
      `Batch ${cleanBatchId} is already recorded on the blockchain. Each batch ID can only be recorded once with this contract.`,
    );
  }

  const tx = await contract.recordBatch(cleanBatchId, dataHash);

  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Blockchain transaction failed or was not confirmed.");
  }

  return {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}

/**
 * Verifies a batch hash against the GreenTrace smart contract.
 *
 * This is a READ-ONLY operation.
 * MetaMask is NOT required.
 *
 * Returns:
 * true  -> supplied hash exactly matches the hash stored on Sepolia
 * false -> supplied hash does not match the stored hash
 */
export async function verifyBatchOnBlockchain(
  batchId: string,
  dataHash: string,
): Promise<boolean> {
  const cleanBatchId = batchId.trim();

  if (!cleanBatchId) {
    throw new Error("Batch ID is required.");
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(dataHash)) {
    throw new Error("Invalid data hash. Expected a 32-byte hexadecimal hash.");
  }

  const contract = getReadOnlyContract();

  const result: boolean = await contract.verifyBatch(cleanBatchId, dataHash);

  return Boolean(result);
}

/**
 * Reads the hash currently stored on Sepolia for a batch ID.
 *
 * This is useful for diagnostics and does not require MetaMask.
 */
export async function getBatchHashFromBlockchain(
  batchId: string,
): Promise<string> {
  const cleanBatchId = batchId.trim();

  if (!cleanBatchId) {
    throw new Error("Batch ID is required.");
  }

  const contract = getReadOnlyContract();

  const hash: string = await contract.batchHashes(cleanBatchId);

  return hash;
}
