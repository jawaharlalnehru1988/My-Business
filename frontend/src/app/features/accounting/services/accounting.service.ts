import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Ledger, JournalEntry } from '../models/accounting.model';

@Injectable({
  providedIn: 'root'
})
export class AccountingService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/v1/accounting';

  getLedgers(): Observable<Ledger[]> {
    return this.http.get<Ledger[]>(`${this.apiUrl}/ledgers`);
  }

  getJournalEntries(): Observable<JournalEntry[]> {
    return this.http.get<JournalEntry[]>(`${this.apiUrl}/journal-entries`);
  }

  postJournalEntry(entry: JournalEntry): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${this.apiUrl}/journal-entries`, entry);
  }
}
