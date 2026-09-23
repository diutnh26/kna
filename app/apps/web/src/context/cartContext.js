import { createContext } from 'react';

/**
 * Split from CartProvider so this module exports only the context object.
 * A file exporting both a component and a context loses context identity
 * on every Fast Refresh, which unmounts every consumer mid-edit.
 */
export const CartContext = createContext(null);
