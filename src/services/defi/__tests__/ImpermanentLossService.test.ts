import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  impermanentLossService,
  calculateIL,
  calculateILPercent,
  calculateHodlValue,
} from '../ImpermanentLossService';
import { DefiPosition } from '../../../stores/defiStore';

describe('ImpermanentLossService', () => {
  describe('calculateIL', () => {
    it('should return 0 IL when price ratio is 1 (no change)', () => {
      const il = calculateIL(1);
      expect(il.toNumber()).toBeCloseTo(0, 10);
    });

    it('should calculate IL for 2x price increase', () => {
      // When one token doubles, IL should be approximately -5.72%
      const il = calculateIL(2);
      expect(il.toNumber()).toBeCloseTo(-0.0572, 3);
    });

    it('should calculate IL for 0.5x price decrease (halving)', () => {
      // When one token halves, IL should be approximately -5.72%
      const il = calculateIL(0.5);
      expect(il.toNumber()).toBeCloseTo(-0.0572, 3);
    });

    it('should calculate IL for 4x price increase', () => {
      // When one token 4x, IL should be approximately -20%
      const il = calculateIL(4);
      expect(il.toNumber()).toBeCloseTo(-0.2, 1);
    });

    it('should calculate IL for 0.25x price decrease (1/4)', () => {
      // When one token goes to 1/4, IL should be approximately -20%
      const il = calculateIL(0.25);
      expect(il.toNumber()).toBeCloseTo(-0.2, 1);
    });

    it('should return 0 for zero or negative price ratio', () => {
      expect(calculateIL(0).toNumber()).toBe(0);
      expect(calculateIL(-1).toNumber()).toBe(0);
    });

    it('should handle Decimal input', () => {
      const il = calculateIL(new Decimal(2));
      expect(il.toNumber()).toBeCloseTo(-0.0572, 3);
    });

    it('should calculate IL symmetrically for inverse ratios', () => {
      const il2x = calculateIL(2);
      const il0_5x = calculateIL(0.5);
      // IL should be the same for 2x and 0.5x (inverse)
      expect(il2x.toNumber()).toBeCloseTo(il0_5x.toNumber(), 6);
    });
  });

  describe('calculateILPercent', () => {
    it('should return percentage value', () => {
      const ilPercent = calculateILPercent(2);
      expect(ilPercent).toBeCloseTo(-5.72, 1);
    });

    it('should return 0 for no price change', () => {
      const ilPercent = calculateILPercent(1);
      expect(ilPercent).toBeCloseTo(0, 5);
    });
  });

  describe('calculateHodlValue', () => {
    it('should calculate HODL value correctly', () => {
      const entryAmounts = [new Decimal(10), new Decimal(100)];
      const currentPrices = [new Decimal(200), new Decimal(1)];

      const hodlValue = calculateHodlValue(entryAmounts, currentPrices);
      // 10 * 200 + 100 * 1 = 2100
      expect(hodlValue.toNumber()).toBe(2100);
    });

    it('should return 0 for mismatched arrays', () => {
      const entryAmounts = [new Decimal(10)];
      const currentPrices = [new Decimal(200), new Decimal(1)];

      const hodlValue = calculateHodlValue(entryAmounts, currentPrices);
      expect(hodlValue.toNumber()).toBe(0);
    });

    it('should handle empty arrays', () => {
      const hodlValue = calculateHodlValue([], []);
      expect(hodlValue.toNumber()).toBe(0);
    });
  });

  describe('impermanentLossService', () => {
    describe('getInstance', () => {
      it('should return singleton instance', () => {
        const instance1 = impermanentLossService;
        const instance2 = impermanentLossService;
        expect(instance1).toBe(instance2);
      });
    });

    describe('calculatePositionIL', () => {
      const createLPPosition = (id: string, assets: string[], amounts: Decimal[]): DefiPosition => ({
        id,
        walletId: 'test-wallet',
        protocol: 'Uniswap V3',
        positionType: 'lp',
        poolAddress: null,
        assets,
        amounts,
        costBasisUsd: new Decimal(10000),
        currentValueUsd: new Decimal(10000),
        rewardsEarned: {},
        apy: 20,
        maturityDate: null,
        healthFactor: null,
        chain: 'Ethereum',
        entryDate: new Date(),
        updatedAt: new Date(),
      });

      it('should calculate IL for LP position with price change', () => {
        const position = createLPPosition('1', ['ETH', 'USDC'], [new Decimal(5), new Decimal(10000)]);
        const entryPrices = [2000, 1]; // ETH at $2000, USDC at $1
        const currentPrices = [4000, 1]; // ETH doubled to $4000

        const result = impermanentLossService.calculatePositionIL(position, entryPrices, currentPrices);

        expect(result).not.toBeNull();
        expect(result?.impermanentLoss.toNumber()).toBeLessThan(0);
      });

      it('should return null for non-LP positions', () => {
        const position = createLPPosition('1', ['ETH'], [new Decimal(5)]);
        position.positionType = 'lending';

        const result = impermanentLossService.calculatePositionIL(position, [2000], [4000]);

        expect(result).toBeNull();
      });

      it('should return null for positions with less than 2 assets', () => {
        const position = createLPPosition('1', ['ETH'], [new Decimal(5)]);

        const result = impermanentLossService.calculatePositionIL(position, [2000], [4000]);

        expect(result).toBeNull();
      });

      it('should return null when price arrays dont match', () => {
        const position = createLPPosition('1', ['ETH', 'USDC'], [new Decimal(5), new Decimal(10000)]);

        const result = impermanentLossService.calculatePositionIL(position, [2000], [4000, 1]);

        expect(result).toBeNull();
      });

      it('should include token info in result', () => {
        const position = createLPPosition('1', ['ETH', 'USDC'], [new Decimal(5), new Decimal(10000)]);
        const entryPrices = [2000, 1];
        const currentPrices = [4000, 1];

        const result = impermanentLossService.calculatePositionIL(position, entryPrices, currentPrices);

        expect(result?.tokens).toHaveLength(2);
        expect(result?.tokens[0].symbol).toBe('ETH');
        expect(result?.tokens[0].priceChange).toBe(100); // 100% increase
        expect(result?.tokens[1].symbol).toBe('USDC');
        expect(result?.tokens[1].priceChange).toBe(0); // No change
      });
    });

    describe('calculateLiquidationRisk', () => {
      const createBorrowingPosition = (healthFactor: number | null): DefiPosition => ({
        id: 'test-1',
        walletId: 'test-wallet',
        protocol: 'Aave',
        positionType: 'borrowing',
        poolAddress: null,
        assets: ['ETH'],
        amounts: [new Decimal(1)],
        costBasisUsd: new Decimal(0),
        currentValueUsd: new Decimal(1000),
        rewardsEarned: {},
        apy: null,
        maturityDate: null,
        healthFactor,
        chain: 'Ethereum',
        entryDate: null,
        updatedAt: new Date(),
      });

      it('should return null for positions without health factor', () => {
        const position = createBorrowingPosition(null);
        position.positionType = 'lending';

        const result = impermanentLossService.calculateLiquidationRisk(position);

        expect(result).toBeNull();
      });

      it('should classify safe health factor (>= 2)', () => {
        const position = createBorrowingPosition(2.5);

        const result = impermanentLossService.calculateLiquidationRisk(position);

        expect(result?.riskLevel).toBe('safe');
      });

      it('should classify moderate health factor (1.5 - 2)', () => {
        const position = createBorrowingPosition(1.7);

        const result = impermanentLossService.calculateLiquidationRisk(position);

        expect(result?.riskLevel).toBe('moderate');
      });

      it('should classify high health factor (1.1 - 1.5)', () => {
        const position = createBorrowingPosition(1.3);

        const result = impermanentLossService.calculateLiquidationRisk(position);

        expect(result?.riskLevel).toBe('high');
      });

      it('should classify critical health factor (< 1.1)', () => {
        const position = createBorrowingPosition(1.05);

        const result = impermanentLossService.calculateLiquidationRisk(position);

        expect(result?.riskLevel).toBe('critical');
      });

      it('should calculate distance to liquidation', () => {
        const position = createBorrowingPosition(2);

        const result = impermanentLossService.calculateLiquidationRisk(position);

        expect(result?.distanceToLiquidation).toBe(50); // 50% distance to liquidation
      });
    });

    describe('estimateILForPriceChange', () => {
      it('should estimate IL for 50% price increase', () => {
        const result = impermanentLossService.estimateILForPriceChange(50);

        expect(result.il).toBeLessThan(0);
        expect(result.description).toBeDefined();
      });

      it('should estimate IL for -50% price decrease', () => {
        const result = impermanentLossService.estimateILForPriceChange(-50);

        expect(result.il).toBeLessThan(0);
        expect(result.description).toBeDefined();
      });

      it('should return negligible IL for small changes', () => {
        const result = impermanentLossService.estimateILForPriceChange(5);

        expect(Math.abs(result.il)).toBeLessThan(1);
        expect(result.description).toBe('Negligible IL');
      });
    });

    describe('getILRiskLevel', () => {
      it('should return low for IL < 2%', () => {
        expect(impermanentLossService.getILRiskLevel(-1)).toBe('low');
        expect(impermanentLossService.getILRiskLevel(1)).toBe('low');
      });

      it('should return moderate for IL 2-5%', () => {
        expect(impermanentLossService.getILRiskLevel(-3)).toBe('moderate');
        expect(impermanentLossService.getILRiskLevel(4)).toBe('moderate');
      });

      it('should return high for IL 5-10%', () => {
        expect(impermanentLossService.getILRiskLevel(-7)).toBe('high');
        expect(impermanentLossService.getILRiskLevel(8)).toBe('high');
      });

      it('should return severe for IL > 10%', () => {
        expect(impermanentLossService.getILRiskLevel(-15)).toBe('severe');
        expect(impermanentLossService.getILRiskLevel(20)).toBe('severe');
      });
    });
  });
});
