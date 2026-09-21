import { createContext } from 'react';

/**
 * Split from the provider so this module exports only the context object.
 * Fast Refresh replaces a module wholesale; a file that exports both a
 * component and a context loses context identity on every edit, which
 * unmounts every consumer. Same reason authContext.js sits apart from
 * AuthProvider.jsx.
 */
export const EthnicityContext = createContext(null);
