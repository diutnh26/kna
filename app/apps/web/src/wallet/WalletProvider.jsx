import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';

const WalletContext = createContext(null);
const DEVNET = 'devnet';
const EXPECTED_GENESIS = null; // soft check via RPC endpoint only

function getProvider() {
  const provider = window.solana;
  if (!provider?.isPhantom) {
    throw new Error('Install Phantom wallet (devnet) for operator flows.');
  }
  return provider;
}

export function WalletProvider({ children }) {
  const [pubkey, setPubkey] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl('devnet');

  const connection = useMemo(() => new Connection(rpcUrl, 'confirmed'), [rpcUrl]);

  const assertDevnet = useCallback(async () => {
    const provider = getProvider();
    // Phantom may expose network hints; prefer RPC health + program cluster env.
    if (provider.network && provider.network !== 'devnet' && provider.network !== DEVNET) {
      throw new Error('Switch Phantom to Devnet before continuing.');
    }
    void EXPECTED_GENESIS;
    await connection.getLatestBlockhash('confirmed');
  }, [connection]);

  const connect = useCallback(async () => {
    setError('');
    setConnecting(true);
    try {
      await assertDevnet();
      const provider = getProvider();
      const resp = await provider.connect();
      setPubkey(resp.publicKey.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet connection failed');
      setPubkey(null);
    } finally {
      setConnecting(false);
    }
  }, [assertDevnet]);

  const disconnect = useCallback(async () => {
    try {
      await window.solana?.disconnect?.();
    } catch {
      /* optional */
    }
    setPubkey(null);
  }, []);

  const signMessage = useCallback(async (message) => {
    const provider = getProvider();
    if (!provider.signMessage) {
      throw new Error('Wallet cannot sign messages');
    }
    const encoded = new TextEncoder().encode(message);
    const { signature } = await provider.signMessage(encoded, 'utf8');
    return btoa(String.fromCharCode(...signature));
  }, []);

  const signAndSendTransaction = useCallback(
    async (transactionBase64) => {
      await assertDevnet();
      const provider = getProvider();
      const raw = Uint8Array.from(atob(transactionBase64), (c) => c.charCodeAt(0));
      const tx = Transaction.from(raw);
      if (provider.signAndSendTransaction) {
        const { signature } = await provider.signAndSendTransaction(tx, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        await connection.confirmTransaction(signature, 'confirmed');
        return signature;
      }
      const signed = await provider.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      await connection.confirmTransaction(signature, 'confirmed');
      return signature;
    },
    [assertDevnet, connection]
  );

  const value = useMemo(
    () => ({
      pubkey,
      publicKey: pubkey ? new PublicKey(pubkey) : null,
      connecting,
      error,
      connected: Boolean(pubkey),
      cluster: DEVNET,
      connection,
      connect,
      disconnect,
      signMessage,
      signAndSendTransaction,
    }),
    [
      pubkey,
      connecting,
      error,
      connection,
      connect,
      disconnect,
      signMessage,
      signAndSendTransaction,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
