/**
 * Shown when a screen cannot reach the API.
 *
 * The hint naming `apps/api` and localhost:4000 is for whoever is running
 * the project locally, and is compiled out of production builds: a visitor
 * to the deployed site cannot act on it, and being told to check their own
 * localhost reads as broken software rather than as help. The deployed
 * build says the thing that is actually true there — the free API sleeps
 * after 15 minutes idle and takes about a minute to wake, which is by far
 * the most likely reason a real visitor sees this.
 *
 * Previously duplicated verbatim across six screens.
 */
export default function ApiErrorNotice({ className = 'py-20' }) {
  return (
    <div className={`border border-dashed border-[#F5EDDD]/20 text-center ${className}`}>
      <p className="font-display text-2xl mb-3">Couldn&rsquo;t reach the KNĂ API.</p>
      <p className="text-sm text-[#F5EDDD]/60">
        {import.meta.env.DEV ? (
          <>
            Is <code className="text-[#E8A33D]">apps/api</code> running on{' '}
            <code className="text-[#E8A33D]">localhost:4000</code>?
          </>
        ) : (
          <>The service may be waking up — that can take a minute. Please try again shortly.</>
        )}
      </p>
    </div>
  );
}
