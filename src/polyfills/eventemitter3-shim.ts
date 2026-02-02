/**
 * EventEmitter3 shim for default export compatibility
 * Some packages (Solana wallet adapters, Anchor, etc.) use:
 *   import EventEmitter from 'eventemitter3'
 * But eventemitter3 v5 only provides named exports.
 * This shim provides both default and named exports.
 */

// Import directly from the package's internal file to avoid circular reference
// @ts-expect-error - Direct import from package internals
import EventEmitter from '../../node_modules/eventemitter3/index.mjs';

export default EventEmitter;
export { EventEmitter };
