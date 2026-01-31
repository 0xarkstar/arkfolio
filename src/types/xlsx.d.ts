declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: { [key: string]: WorkSheet };
  }

  export interface WorkSheet {
    [key: string]: any;
    '!cols'?: ColInfo[];
    '!rows'?: RowInfo[];
    '!ref'?: string;
  }

  export interface ColInfo {
    wch?: number;
    wpx?: number;
  }

  export interface RowInfo {
    hpt?: number;
    hpx?: number;
  }

  export interface WritingOptions {
    bookType?: 'xlsx' | 'xlsm' | 'xlsb' | 'xls' | 'csv' | 'txt' | 'html';
    type?: 'base64' | 'binary' | 'buffer' | 'file' | 'array' | 'string';
  }

  export const utils: {
    book_new(): WorkBook;
    book_append_sheet(workbook: WorkBook, worksheet: WorkSheet, sheetname?: string): void;
    aoa_to_sheet(data: any[][]): WorkSheet;
    json_to_sheet(data: object[]): WorkSheet;
  };

  export function write(workbook: WorkBook, options?: WritingOptions): any;
  export function writeFile(workbook: WorkBook, filename: string, options?: WritingOptions): void;
}
