import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { useWallet } from './WalletProvider';

/** Coordinator submits a real Phantom-signed submit_attestation tx on devnet. */
export default function AttestationPanel({ ledgerEntryId, token }) {
  const { t } = useTranslation();
  const { connected, pubkey, signAndSendTransaction, connect } = useWallet();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ledgerEntryId) return;
    api.chainLedger(ledgerEntryId)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [ledgerEntryId]);

  async function prepareAndSubmit() {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      if (!connected || !pubkey) {
        await connect();
      }
      const coordinatorPubkey = window.solana?.publicKey?.toString?.() || pubkey;
      if (!coordinatorPubkey) {
        throw new Error(t('wallet.connectRequired'));
      }
      const prepared = await api.chainPrepare(
        ledgerEntryId,
        { coordinatorPubkey },
        token
      );
      const pendingTxSig = await signAndSendTransaction(prepared.transactionBase64);
      await api.chainSubmit(
        ledgerEntryId,
        { pendingTxSig, coordinatorPubkey },
        token
      );
      setStatus(await api.chainLedger(ledgerEntryId));
    } catch (err) {
      setError(err.message ?? t('wallet.attestError'));
    } finally {
      setBusy(false);
    }
  }

  if (!ledgerEntryId) return null;

  const explorer = status?.explorer?.pending || status?.explorer?.pendingPda;

  return (
    <div className="mt-3 border border-amber/20 p-3 text-xs space-y-2">
      <div className="uppercase tracking-wider text-copper">{t('wallet.attestation')}</div>
      {status ? (
        <div className="text-bone/80 space-y-1">
          <div>{t('wallet.attestationState', { state: status.state })}</div>
          {status.payloadHash ? (
            <div className="font-mono text-[10px] break-all opacity-70">
              hash {status.payloadHash.slice(0, 16)}…
            </div>
          ) : null}
          {explorer ? (
            <a href={explorer} target="_blank" rel="noreferrer" className="block underline mt-1">
              {t('wallet.viewExplorer')}
            </a>
          ) : (
            <p className="text-bone/50">{t('wallet.proofPending')}</p>
          )}
        </div>
      ) : (
        <div className="text-bone/60">{t('wallet.noAttestation')}</div>
      )}
      {status?.state !== 'FINALIZED' ? (
        <button
          type="button"
          disabled={busy}
          onClick={prepareAndSubmit}
          className="border border-amber/40 px-2 py-1 uppercase tracking-wider disabled:opacity-50"
        >
          {busy ? t('wallet.submitting') : t('wallet.submitAttestation')}
        </button>
      ) : null}
      {error ? <p className="text-kteh">{error}</p> : null}
    </div>
  );
}

export function LedgerProofBadge({ attestation }) {
  const { t } = useTranslation();
  if (!attestation) return null;
  const href =
    attestation.explorer?.finalize ||
    attestation.explorer?.pending ||
    attestation.explorer?.finalPda ||
    attestation.explorer?.pendingPda;
  return (
    <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider">
      <span className="border border-sage/40 text-sage px-1.5 py-0.5">
        {t('wallet.proofState', { state: attestation.state })}
      </span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="underline text-amber">
          {t('wallet.viewExplorer')}
        </a>
      ) : null}
    </span>
  );
}

export function ProofExplainer() {
  const { t } = useTranslation();
  const [chain, setChain] = useState(null);
  useEffect(() => {
    api.chainStatus().then(setChain).catch(() => setChain(null));
  }, []);
  return (
    <div className="mb-4 max-w-2xl space-y-2">
      <p className="text-xs text-bone/55">{t('wallet.proofExplainer')}</p>
      {chain?.committeeVault ? (
        <p className="text-[10px] font-mono text-bone/45 break-all">
          {t('wallet.committeeVault')}: {chain.committeeVault}
        </p>
      ) : null}
    </div>
  );
}

export function GuestReceiptPanel() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { connected, connect, signMessage } = useWallet();
  const [linked, setLinked] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    api.walletMe(token).then(setLinked).catch(() => setLinked(null));
  }, [token]);

  async function linkWallet() {
    if (!token) return;
    setError('');
    try {
      if (!connected) {
        await connect();
      }
      const challenge = await api.walletChallenge(token);
      const signature = await signMessage(challenge.message);
      const res = await api.walletLink(
        {
          pubkey: window.solana.publicKey.toString(),
          signature,
          nonce: challenge.nonce,
        },
        token
      );
      setLinked(res);
      setMsg(t('wallet.linkedOk'));
    } catch (err) {
      setError(err.message ?? t('wallet.attestError'));
    }
  }

  return (
    <div className="border border-bone/10 p-4 space-y-2 text-sm">
      <p className="text-bone/70">{t('wallet.guestReceiptHint')}</p>
      {linked?.pubkey ? (
        <p className="text-xs font-mono">{linked.pubkey}</p>
      ) : (
        <button
          type="button"
          onClick={linkWallet}
          className="text-xs uppercase tracking-wider border px-3 py-1.5"
        >
          {t('wallet.linkOptional')}
        </button>
      )}
      {msg ? <p className="text-sage text-xs">{msg}</p> : null}
      {error ? <p className="text-kteh text-xs">{error}</p> : null}
    </div>
  );
}

export function CommitteeFinalizePanel({ token }) {
  const { t } = useTranslation();
  const { connected, pubkey, connect } = useWallet();
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function refresh() {
    if (!token) return;
    setRows(await api.chainAwaitingCommittee(token));
  }

  useEffect(() => {
    refresh().catch(() => setRows([]));
  }, [token]);

  async function loadSquadsProposal(ledgerEntryId) {
    setBusyId(ledgerEntryId);
    setError('');
    try {
      if (!connected) await connect();
      const multisigPda = window.prompt(t('wallet.pasteMultisigPdaOptional'))?.trim() || undefined;
      const ix = await api.chainSquadsProposal(ledgerEntryId, { multisigPda }, token);
      setNote(
        [
          t('wallet.squadsHint'),
          `vault=${ix.vault}`,
          ix.vaultCheck?.multisigPda ? `multisig=${ix.vaultCheck.multisigPda}` : null,
          `pendingPda=${ix.pendingPda}`,
          `finalPda=${ix.finalPda}`,
          `data=${ix.instruction.dataBase64.slice(0, 24)}…`,
        ]
          .filter(Boolean)
          .join('\n')
      );
      return ix;
    } catch (err) {
      setError(err.message ?? t('wallet.attestError'));
    } finally {
      setBusyId(null);
    }
  }

  async function recordFinalize(ledgerEntryId, finalizeTxSig) {
    setBusyId(ledgerEntryId);
    setError('');
    try {
      await api.chainFinalize(ledgerEntryId, { finalizeTxSig }, token);
      await refresh();
    } catch (err) {
      setError(err.message ?? t('wallet.attestError'));
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  return (
    <div className="border border-sage/30 p-4 space-y-3 text-xs">
      <div className="uppercase tracking-wider text-sage">{t('wallet.committeeQueue')}</div>
      <p className="text-bone/60">{t('wallet.squadsHint')}</p>
      {rows.length === 0 ? (
        <p className="text-bone/40">{t('wallet.noAwaiting')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.ledgerEntryId} className="border border-bone/10 p-2 space-y-2">
              <div className="font-mono">{row.ledgerEntryId.slice(-10)}</div>
              <div>
                {row.toLabel} · {row.totalVnd?.toLocaleString?.('vi-VN')} ₫
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === row.ledgerEntryId}
                  onClick={() => loadSquadsProposal(row.ledgerEntryId)}
                  className="border px-2 py-1 uppercase tracking-wider"
                >
                  {t('wallet.exportSquadsProposal')}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.ledgerEntryId}
                  onClick={() => {
                    const sig = window.prompt(t('wallet.pasteFinalizeSig'));
                    if (sig) recordFinalize(row.ledgerEntryId, sig.trim());
                  }}
                  className="border border-sage/50 px-2 py-1 uppercase tracking-wider"
                >
                  {t('wallet.recordFinalize')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-bone/45">
        {t('wallet.squadsPasteback')}
      </p>
      {note ? <pre className="whitespace-pre-wrap text-[10px] opacity-70">{note}</pre> : null}
      {error ? <p className="text-kteh">{error}</p> : null}
    </div>
  );
}
