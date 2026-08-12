import { useState, useEffect } from 'react';
import Landing from './components/Landing';
import Explore from './components/Explore';
import Travel from './components/Travel';
import Marketplace from './components/Marketplace';
import Assistant from './components/Assistant';
import CarbonTracker from './components/CarbonTracker';
import Community from './components/Community';

/**
 * Lightweight hash router for the KNĂ prototype.
 *
 *   /               → Landing
 *   /#explore       → Cultural archive
 *   /#travel        → Experiences and booking
 *   /#marketplace   → Artisan marketplace
 *   /#assistant     → Travel assistant
 *   /#impact        → Carbon tracker
 *   /#community     → Community space
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
  '#impact': CarbonTracker,
  '#community': Community,
};

export default function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [hash]);

  const Screen = ROUTES[hash] ?? Landing;
  return <Screen />;
}
