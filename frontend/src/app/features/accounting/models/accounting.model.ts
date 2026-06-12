export interface Ledger {
  id: number;
  name: string;
  accountGroup: string;
  currentBalance: number;
}

export interface JournalEntryLine {
  id?: number;
  ledgerId: number;
  ledgerName?: string;
  debitAmount: number;
  creditAmount: number;
}

export interface JournalEntry {
  id?: number;
  entryDate: string;
  description: string;
  referenceNumber: string;
  lines: JournalEntryLine[];
}
