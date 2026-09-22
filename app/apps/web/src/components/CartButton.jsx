import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../context/useCart';

/**
 * The way into the cart, and the only signal that something landed in it.
 *
 * The badge animates off `addedAt` rather than off `count`: adding a second
 * of the same piece changes the total but a person who just pressed a
 * button needs to see that the press registered either way.
 */
export default function CartButton({ theme = 'dark' }) {
  const { t } = useTranslation();
  const { count, addedAt, open } = useCart();
  const [bumping, setBumping] = useState(false);
  const seen = useRef(addedAt);

  useEffect(() => {
    if (addedAt === seen.current) return undefined;
    seen.current = addedAt;
    setBumping(true);
    const timer = setTimeout(() => setBumping(false), 440);
    return () => clearTimeout(timer);
  }, [addedAt]);

  const border =
    theme === 'dark'
      ? 'border-bone/30 hover:border-bone/70'
      : 'border-ink/30 hover:border-ink/70';

  return (
    <button
      onClick={open}
      aria-label={t('cart.open', { count })}
      title={t('cart.title')}
      className={`relative inline-flex items-center justify-center w-8 h-8 border ${border} transition`}
    >
      <ShoppingBag className="w-4 h-4" />
      {count > 0 && (
        <span
          // aria-hidden because the count is already in the button's label;
          // announcing it twice makes the control read as two things.
          aria-hidden="true"
          className={`absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 grid place-items-center bg-kteh text-bone text-[10px] font-medium tabular-nums rounded-full ${
            bumping ? 'badge-bump' : ''
          }`}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
