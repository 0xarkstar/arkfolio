/**
 * Browser polyfill for Node.js 'module' built-in
 * Provides createRequire stub for browser compatibility
 */

// createRequire is not available in browser, return a no-op
export function createRequire(_url: string | URL) {
  return function require(_id: string): never {
    throw new Error(
      `Dynamic require is not supported in browser environment. ` +
      `Attempted to require: ${_id}`
    );
  };
}

// Module stub
export const Module = {
  createRequire,
};

export default Module;
