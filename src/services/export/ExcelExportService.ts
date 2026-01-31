import ExcelJS from 'exceljs';
import Decimal from 'decimal.js';

export interface ExcelExportOptions {
  filename: string;
  sheets: ExcelSheet[];
}

export interface ExcelSheet {
  name: string;
  data: Record<string, unknown>[];
  columns?: ExcelColumn[];
}

export interface ExcelColumn {
  key: string;
  header: string;
  width?: number;
  format?: 'currency' | 'percent' | 'number' | 'date' | 'text';
}

export interface PortfolioExportData {
  holdings: {
    symbol: string;
    name?: string;
    amount: number | Decimal;
    priceUsd: number | Decimal;
    valueUsd: number | Decimal;
    allocation: number;
    change24h?: number;
  }[];
  summary: {
    totalValueUsd: number | Decimal;
    totalCostBasis?: number | Decimal;
    unrealizedPnl?: number | Decimal;
    assetCount: number;
  };
}

export interface TaxExportData {
  year: number;
  summary: {
    totalGainsKrw: number | Decimal;
    totalLossesKrw: number | Decimal;
    netGainsKrw: number | Decimal;
    taxableGainsKrw: number | Decimal;
    estimatedTaxKrw: number | Decimal;
  };
  transactions: {
    date: Date | string;
    type: string;
    asset: string;
    amount: number | Decimal;
    priceKrw: number | Decimal;
    gainLossKrw?: number | Decimal;
    exchange?: string;
  }[];
}

export interface TransactionExportData {
  transactions: {
    date: Date | string;
    type: string;
    asset: string;
    amount: number | Decimal;
    priceUsd?: number | Decimal;
    fee?: number | Decimal;
    feeAsset?: string;
    exchange?: string;
    wallet?: string;
    txHash?: string;
  }[];
}

class ExcelExportService {
  private toNumber(value: number | Decimal | undefined): number {
    if (value === undefined) return 0;
    return value instanceof Decimal ? value.toNumber() : value;
  }

  private formatDate(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
  }

  /**
   * Export generic data to Excel
   */
  async exportToExcel(options: ExcelExportOptions): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ArkFolio';
    workbook.created = new Date();

    for (const sheet of options.sheets) {
      // Prepare headers and keys
      const headers = sheet.columns?.map((c) => c.header) || Object.keys(sheet.data[0] || {});
      const keys = sheet.columns?.map((c) => c.key) || Object.keys(sheet.data[0] || {});

      // Create worksheet
      const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31)); // Excel sheet name limit

      // Set column definitions
      if (sheet.columns) {
        worksheet.columns = sheet.columns.map((c) => ({
          header: c.header,
          key: c.key,
          width: c.width || 15,
        }));
      } else {
        worksheet.columns = headers.map((h, i) => ({
          header: h,
          key: keys[i],
          width: 15,
        }));
      }

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data rows
      for (const row of sheet.data) {
        const rowData = keys.map((key) => {
          const value = row[key];
          if (value instanceof Decimal) return value.toNumber();
          if (value instanceof Date) return this.formatDate(value);
          return value;
        });
        worksheet.addRow(rowData);
      }

      // Apply number formats based on column format
      if (sheet.columns) {
        sheet.columns.forEach((col, colIndex) => {
          const column = worksheet.getColumn(colIndex + 1);
          switch (col.format) {
            case 'currency':
              column.numFmt = '#,##0.00';
              break;
            case 'percent':
              column.numFmt = '0.00%';
              break;
            case 'number':
              column.numFmt = '#,##0.########';
              break;
          }
        });
      }
    }

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    this.downloadFile(buffer as ArrayBuffer, options.filename);
  }

  /**
   * Export portfolio holdings to Excel
   */
  async exportPortfolio(data: PortfolioExportData, filename?: string): Promise<void> {
    const holdingsData = data.holdings.map((h) => ({
      symbol: h.symbol,
      name: h.name || h.symbol,
      amount: this.toNumber(h.amount),
      priceUsd: this.toNumber(h.priceUsd),
      valueUsd: this.toNumber(h.valueUsd),
      allocation: h.allocation / 100, // Convert to decimal for percent format
      change24h: (h.change24h ?? 0) / 100,
    }));

    const summaryData = [
      { metric: 'Total Value (USD)', value: this.toNumber(data.summary.totalValueUsd) },
      { metric: 'Total Cost Basis (USD)', value: this.toNumber(data.summary.totalCostBasis) },
      { metric: 'Unrealized P&L (USD)', value: this.toNumber(data.summary.unrealizedPnl) },
      { metric: 'Asset Count', value: data.summary.assetCount },
    ];

    await this.exportToExcel({
      filename: filename || `portfolio-${this.formatDate(new Date())}.xlsx`,
      sheets: [
        {
          name: 'Holdings',
          data: holdingsData,
          columns: [
            { key: 'symbol', header: 'Symbol', width: 10 },
            { key: 'name', header: 'Name', width: 20 },
            { key: 'amount', header: 'Amount', width: 15, format: 'number' },
            { key: 'priceUsd', header: 'Price (USD)', width: 15, format: 'currency' },
            { key: 'valueUsd', header: 'Value (USD)', width: 15, format: 'currency' },
            { key: 'allocation', header: 'Allocation (%)', width: 12, format: 'percent' },
            { key: 'change24h', header: '24h Change (%)', width: 12, format: 'percent' },
          ],
        },
        {
          name: 'Summary',
          data: summaryData,
          columns: [
            { key: 'metric', header: 'Metric', width: 25 },
            { key: 'value', header: 'Value', width: 20 },
          ],
        },
      ],
    });
  }

  /**
   * Export tax report to Excel
   */
  async exportTaxReport(data: TaxExportData, filename?: string): Promise<void> {
    const summaryData = [
      { metric: 'Tax Year', value: data.year },
      { metric: 'Total Gains (KRW)', value: this.toNumber(data.summary.totalGainsKrw) },
      { metric: 'Total Losses (KRW)', value: this.toNumber(data.summary.totalLossesKrw) },
      { metric: 'Net Gains (KRW)', value: this.toNumber(data.summary.netGainsKrw) },
      { metric: 'Taxable Gains (KRW)', value: this.toNumber(data.summary.taxableGainsKrw) },
      { metric: 'Estimated Tax (KRW)', value: this.toNumber(data.summary.estimatedTaxKrw) },
    ];

    const transactionsData = data.transactions.map((tx) => ({
      date: this.formatDate(tx.date),
      type: tx.type,
      asset: tx.asset,
      amount: this.toNumber(tx.amount),
      priceKrw: this.toNumber(tx.priceKrw),
      gainLossKrw: this.toNumber(tx.gainLossKrw),
      exchange: tx.exchange || '',
    }));

    await this.exportToExcel({
      filename: filename || `tax-report-${data.year}.xlsx`,
      sheets: [
        {
          name: 'Summary',
          data: summaryData,
          columns: [
            { key: 'metric', header: 'Metric', width: 25 },
            { key: 'value', header: 'Value', width: 25 },
          ],
        },
        {
          name: 'Transactions',
          data: transactionsData,
          columns: [
            { key: 'date', header: 'Date', width: 12 },
            { key: 'type', header: 'Type', width: 10 },
            { key: 'asset', header: 'Asset', width: 10 },
            { key: 'amount', header: 'Amount', width: 15, format: 'number' },
            { key: 'priceKrw', header: 'Price (KRW)', width: 18, format: 'currency' },
            { key: 'gainLossKrw', header: 'Gain/Loss (KRW)', width: 18, format: 'currency' },
            { key: 'exchange', header: 'Exchange', width: 15 },
          ],
        },
      ],
    });
  }

  /**
   * Export transaction history to Excel
   */
  async exportTransactions(data: TransactionExportData, filename?: string): Promise<void> {
    const transactionsData = data.transactions.map((tx) => ({
      date: this.formatDate(tx.date),
      type: tx.type,
      asset: tx.asset,
      amount: this.toNumber(tx.amount),
      priceUsd: this.toNumber(tx.priceUsd),
      fee: this.toNumber(tx.fee),
      feeAsset: tx.feeAsset || '',
      exchange: tx.exchange || '',
      wallet: tx.wallet || '',
      txHash: tx.txHash || '',
    }));

    await this.exportToExcel({
      filename: filename || `transactions-${this.formatDate(new Date())}.xlsx`,
      sheets: [
        {
          name: 'Transactions',
          data: transactionsData,
          columns: [
            { key: 'date', header: 'Date', width: 12 },
            { key: 'type', header: 'Type', width: 12 },
            { key: 'asset', header: 'Asset', width: 10 },
            { key: 'amount', header: 'Amount', width: 15, format: 'number' },
            { key: 'priceUsd', header: 'Price (USD)', width: 15, format: 'currency' },
            { key: 'fee', header: 'Fee', width: 12, format: 'number' },
            { key: 'feeAsset', header: 'Fee Asset', width: 10 },
            { key: 'exchange', header: 'Exchange', width: 15 },
            { key: 'wallet', header: 'Wallet', width: 15 },
            { key: 'txHash', header: 'Tx Hash', width: 25 },
          ],
        },
      ],
    });
  }

  /**
   * Export DeFi positions to Excel
   */
  async exportDefiPositions(
    positions: {
      protocol: string;
      type: string;
      chain: string;
      assets: string;
      valueUsd: number | Decimal;
      costBasisUsd: number | Decimal;
      pnl: number | Decimal;
      apy?: number;
      healthFactor?: number;
    }[],
    filename?: string
  ): Promise<void> {
    const data = positions.map((p) => ({
      protocol: p.protocol,
      type: p.type,
      chain: p.chain,
      assets: p.assets,
      valueUsd: this.toNumber(p.valueUsd),
      costBasisUsd: this.toNumber(p.costBasisUsd),
      pnl: this.toNumber(p.pnl),
      apy: (p.apy || 0) / 100, // Convert to decimal for percent format
      healthFactor: p.healthFactor || 0,
    }));

    await this.exportToExcel({
      filename: filename || `defi-positions-${this.formatDate(new Date())}.xlsx`,
      sheets: [
        {
          name: 'DeFi Positions',
          data,
          columns: [
            { key: 'protocol', header: 'Protocol', width: 15 },
            { key: 'type', header: 'Type', width: 12 },
            { key: 'chain', header: 'Chain', width: 12 },
            { key: 'assets', header: 'Assets', width: 15 },
            { key: 'valueUsd', header: 'Value (USD)', width: 15, format: 'currency' },
            { key: 'costBasisUsd', header: 'Cost Basis (USD)', width: 15, format: 'currency' },
            { key: 'pnl', header: 'P&L (USD)', width: 15, format: 'currency' },
            { key: 'apy', header: 'APY (%)', width: 10, format: 'percent' },
            { key: 'healthFactor', header: 'Health Factor', width: 12, format: 'number' },
          ],
        },
      ],
    });
  }

  private downloadFile(buffer: ArrayBuffer, filename: string): void {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const excelExportService = new ExcelExportService();
