import { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Landing from './components/Landing';
import Explore from './components/Explore';
import Travel from './components/Travel';
import Marketplace from './components/Marketplace';
import Assistant from './components/Assistant';
import CarbonTracker from './components/CarbonTracker';
import Community from './components/Community';
import Review from './components/Review';
import Dashboard from './components/Dashboard';
import Account from './components/Account';
import AuthModal from './components/AuthModal';
import DemoDataBanner from './components/DemoDataBanner';
import DemoBanner from './components/DemoBanner';
import { AuthProvider } from './context/AuthProvider';

/**
 * Lightweight hash router for the KNĂ prototype.
 *
 *   /               → Landing
 *   /#explore       → Cultural archive
 *   /#travel        → Experiences and booking
 *   /#marketplace   → Artisan marketplace
 *   /#assistant     → Travel assistant
 *   /#carbon        → Carbon Journey (footprint estimate and offsets)
 *   /#community     → Community space
 *   /#review        → Committee review queue (gated in the screen itself)
 *   /#dashboard     → Provider earnings + coordinator booking queue
 *   /#account       → The signed-in person's details and activity
 *
 * Swap for react-router-dom when screens need nested
 * routes or URL parameters.
 */
const ROUTES = {
  '': Landing,
  '#home': Landing,
  '#explore': Explore,
  '#travel': Travel,
  '#marketplace': Marketplace,
  '#assistant': Assistant,
  '#carbon': CarbonTracker,
  // The route was #impact until the screen was renamed Carbon Journey. Kept
  // as an alias because an unknown hash falls through to Landing, so a
  // stale link in a slide deck would quietly open the wrong page rather
  // than fail loudly. Drop it once nothing points here.
  '#impact': CarbonTracker,
  '#community': Community,
  '#review': Review,
  '#dashboard': Dashboard,
  '#account': Account,
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function AppShell() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [hash]);

  // Hash may include query (?verify=…) — route on the path segment only.
  const routeKey = hash.includes('?') ? hash.slice(0, hash.indexOf('?')) : hash;
  const Screen = ROUTES[routeKey] ?? Landing;
  return (
    <AuthProvider>
      {/* Above everything: a demonstration ledger that does not say it is
          one undermines the exact claim this platform is making. */}
      <DemoBanner />
      <DemoDataBanner />
      <Screen />
      <AuthModal />
    </AuthProvider>
  );
}

export default function App() {
  if (GOOGLE_CLIENT_ID) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AppShell />
      </GoogleOAuthProvider>
    );
  }
  return <AppShell />;
}
