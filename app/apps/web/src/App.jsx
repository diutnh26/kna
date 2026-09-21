import { useState, useEffect } from 'react';
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
import { AuthProvider } from './context/AuthProvider';
import { EthnicityProvider } from './context/EthnicityProvider';

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

export default function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // The route, with any query dropped. The ethnicity switcher writes its
  // choice into the hash as `#explore?e=tay`, and ROUTES is an exact-match
  // lookup — without this split every switch would fall through to Landing.
  const path = hash.split('?')[0];

  // Keyed on the route rather than the whole hash, so switching ethnicity
  // leaves the reader where they were. It is a change of subject, not a
  // change of page, and yanking them back to the top mid-read is the
  // single most jarring thing the switch could do.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  const Screen = ROUTES[path] ?? Landing;
  return (
    <AuthProvider>
      <EthnicityProvider>
        {/* Above everything: a demonstration ledger that does not say it is
            one undermines the exact claim this platform is making. */}
        <DemoDataBanner />
        <Screen />
        <AuthModal />
      </EthnicityProvider>
    </AuthProvider>
  );
}
