import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../services/accounting.service';
import { Ledger, JournalEntry, JournalEntryLine } from '../../models/accounting.model';

@Component({
  selector: 'app-accounting-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './accounting-dashboard.component.html',
})
export class AccountingDashboardComponent implements OnInit {
  private accountingService = inject(AccountingService);

  activeTab = signal<'ledgers' | 'journal'>('ledgers');
  
  ledgers = signal<Ledger[]>([]);
  journalEntries = signal<JournalEntry[]>([]);
  
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Manual Entry Form State
  showForm = signal<boolean>(false);
  submitting = signal<boolean>(false);
  formError = signal<string | null>(null);
  
  newEntry = signal<JournalEntry>({
    entryDate: new Date().toISOString().split('T')[0],
    description: '',
    referenceNumber: '',
    lines: []
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.accountingService.getLedgers().subscribe({
      next: (l) => {
        this.ledgers.set(l);
        this.accountingService.getJournalEntries().subscribe({
          next: (j) => {
            this.journalEntries.set(j);
            this.loading.set(false);
          },
          error: (e) => this.handleError(e)
        });
      },
      error: (e) => this.handleError(e)
    });
  }

  handleError(err: any) {
    this.error.set("Failed to load accounting data. Ensure backend is running.");
    this.loading.set(false);
    console.error(err);
  }

  setTab(tab: 'ledgers' | 'journal') {
    this.activeTab.set(tab);
  }

  calculateTotalDebits(entry: JournalEntry): number {
    return entry.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
  }

  calculateTotalCredits(entry: JournalEntry): number {
    return entry.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
  }

  // Form Methods
  get formTotalDebits(): number {
    return this.newEntry().lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
  }

  get formTotalCredits(): number {
    return this.newEntry().lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
  }

  get formDifference(): number {
    return Math.abs(this.formTotalDebits - this.formTotalCredits);
  }

  toggleForm() {
    this.showForm.set(!this.showForm());
    this.formError.set(null);
    if (this.showForm() && this.newEntry().lines.length === 0) {
      this.addLine();
      this.addLine();
    }
  }

  addLine() {
    this.newEntry.update(e => {
      e.lines.push({ ledgerId: 0, debitAmount: 0, creditAmount: 0 });
      return { ...e };
    });
  }

  removeLine(index: number) {
    this.newEntry.update(e => {
      e.lines.splice(index, 1);
      return { ...e };
    });
  }

  submitEntry() {
    this.formError.set(null);
    const entry = this.newEntry();
    
    if (!entry.description) {
      this.formError.set("Description is required.");
      return;
    }

    const validLines = entry.lines.filter(l => l.ledgerId > 0 && (l.debitAmount > 0 || l.creditAmount > 0));
    if (validLines.length < 2) {
      this.formError.set("At least two valid ledger lines with amounts are required.");
      return;
    }

    const totalDebit = validLines.reduce((sum, l) => sum + (l.debitAmount || 0), 0);
    const totalCredit = validLines.reduce((sum, l) => sum + (l.creditAmount || 0), 0);

    if (totalDebit !== totalCredit) {
      this.formError.set(`Debits (${totalDebit}) must equal Credits (${totalCredit}).`);
      return;
    }

    this.submitting.set(true);
    const payload = { ...entry, lines: validLines };
    
    this.accountingService.postJournalEntry(payload).subscribe({
      next: (created) => {
        this.journalEntries.update(curr => [created, ...curr]);
        this.submitting.set(false);
        this.showForm.set(false);
        this.newEntry.set({
          entryDate: new Date().toISOString().split('T')[0],
          description: '',
          referenceNumber: '',
          lines: []
        });
        // Reload ledgers to update balances
        this.accountingService.getLedgers().subscribe(l => this.ledgers.set(l));
      },
      error: (err) => {
        this.formError.set("Failed to post entry. " + (err.error?.message || err.message));
        this.submitting.set(false);
      }
    });
  }
}
