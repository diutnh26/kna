/**
 * Hackathon disclaimer for Approach A demo SPL tokens on Solana devnet.
 * Shown when VITE_DEMO_MODE=true — independent of seed demo-data banner.
 */
export default function DemoBanner() {
  if (import.meta.env.VITE_DEMO_MODE !== 'true') return null;

  return (
    <div
      role="status"
      className="bg-amber-900/90 text-amber-100 text-xs text-center py-1.5 px-4 tracking-wide"
    >
      Demo token — không phải thanh toán thật. Devnet only.
    </div>
  );
}
