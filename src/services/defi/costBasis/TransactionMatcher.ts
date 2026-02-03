import Decimal from 'decimal.js';
import { DefiPosition } from '../../../stores/defiStore';
import { ENTRY_KEYWORDS, PROTOCOL_KEYWORDS, NETWORK_MAP } from './constants';
import { TimelineEventV2 } from './ZapperGraphQL';

/**
 * Utility for matching transactions to DeFi positions
 */
export class TransactionMatcher {
  /**
   * Check if a transaction description indicates an entry into a position
   */
  isEntryTransaction(description: string): boolean {
    const descLower = description.toLowerCase();
    return ENTRY_KEYWORDS.some(keyword => descLower.includes(keyword));
  }

  /**
   * Check if an app matches a protocol name
   */
  isAppMatch(app: { slug: string; displayName: string }, protocol: string): boolean {
    const protocolLower = protocol.toLowerCase();
    const appSlugLower = app.slug.toLowerCase();
    const appNameLower = app.displayName.toLowerCase();

    // Direct match
    if (protocolLower.includes(appSlugLower) || appSlugLower.includes(protocolLower) ||
        protocolLower.includes(appNameLower) || appNameLower.includes(protocolLower)) {
      return true;
    }

    // Check protocol keywords
    for (const [key, keywords] of Object.entries(PROTOCOL_KEYWORDS)) {
      if (protocolLower.includes(key)) {
        return keywords.some(kw => appSlugLower.includes(kw) || appNameLower.includes(kw));
      }
    }

    return false;
  }

  /**
   * Parse amount from transaction description
   * Examples: "Deposited 1,000 USDC", "Staked 5.5 ETH", "Deposited 100 WSTETH"
   */
  parseAmountFromDescription(description: string): { amount: Decimal; symbol: string } | null {
    // Pattern to match amounts like "1,000 USDC", "5.5 ETH", "100 WSTETH"
    const amountPattern = /([\d,]+\.?\d*)\s+([A-Z0-9]{2,10})/gi;
    const matches = [...description.matchAll(amountPattern)];

    if (matches.length > 0) {
      // Take the first match (usually the deposited amount)
      const match = matches[0];
      const amountStr = match[1].replace(/,/g, '');
      const symbol = match[2].toUpperCase();

      try {
        const amount = new Decimal(amountStr);
        if (amount.greaterThan(0)) {
          return { amount, symbol };
        }
      } catch {
        // Invalid number format
      }
    }

    return null;
  }

  /**
   * Find transactions that match a specific DeFi position
   */
  findMatchingTransactions(
    transactions: TimelineEventV2[],
    position: DefiPosition
  ): TimelineEventV2[] {
    const matchedTxs: TimelineEventV2[] = [];

    for (const tx of transactions) {
      if (!tx.app) continue;

      const txChain = NETWORK_MAP[tx.transaction.network] || tx.transaction.network;

      if (!this.isAppMatch(tx.app, position.protocol)) continue;
      if (txChain !== position.chain) continue;

      matchedTxs.push(tx);
    }

    return matchedTxs;
  }
}

export const transactionMatcher = new TransactionMatcher();
