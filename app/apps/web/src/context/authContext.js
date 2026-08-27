import { createContext } from 'react';

// Split into its own file (alongside AuthProvider.jsx for the provider and
// useAuth.js for the hook) because react-refresh/only-export-components
// wants every file to export exactly one kind of thing. Note the provider
// is *not* named AuthContext.jsx — that would collide with this file on
// case-insensitive filesystems (Windows/macOS) and resolve to the wrong one.
export const AuthContext = createContext(null);
