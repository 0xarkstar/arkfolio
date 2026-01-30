import { create } from 'zustand';
import { taxService, TaxSummary, TaxableTransaction } from '../services/tax';

interface TaxState {
  selectedYear: number;
  summary: TaxSummary | null;
  isLoading: boolean;
  error: string | null;
  lastCalculated: Date | null;

  // Actions
  setSelectedYear: (year: number) => void;
  calculateTax: () => Promise<void>;
  saveReport: () => Promise<void>;
  loadSavedReport: () => Promise<void>;
  exportCSV: () => string | null;

  // Getters
  getTaxableTransactions: () => TaxableTransaction[];
}

export const useTaxStore = create<TaxState>((set, get) => ({
  selectedYear: new Date().getFullYear(),
  summary: null,
  isLoading: false,
  error: null,
  lastCalculated: null,

  setSelectedYear: (year) => {
    set({ selectedYear: year, summary: null, error: null });
  },

  calculateTax: async () => {
    const { selectedYear } = get();
    set({ isLoading: true, error: null });

    try {
      const summary = await taxService.calculateTaxSummary(selectedYear);
      set({
        summary,
        isLoading: false,
        lastCalculated: new Date(),
      });
    } catch (error) {
      console.error('Failed to calculate tax:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to calculate tax',
        isLoading: false,
      });
    }
  },

  saveReport: async () => {
    const { summary } = get();
    if (!summary) return;

    try {
      await taxService.saveTaxReport(summary);
    } catch (error) {
      console.error('Failed to save tax report:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to save report',
      });
    }
  },

  loadSavedReport: async () => {
    const { selectedYear } = get();
    set({ isLoading: true, error: null });

    try {
      const saved = await taxService.getTaxReport(selectedYear);
      if (saved) {
        set({
          summary: saved,
          isLoading: false,
        });
      } else {
        // No saved report, calculate fresh
        await get().calculateTax();
      }
    } catch (error) {
      console.error('Failed to load tax report:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load report',
        isLoading: false,
      });
    }
  },

  exportCSV: () => {
    const { summary } = get();
    if (!summary) return null;
    return taxService.exportToCSV(summary);
  },

  getTaxableTransactions: () => {
    const { summary } = get();
    return summary?.taxableTransactions || [];
  },
}));
