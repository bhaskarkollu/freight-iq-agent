import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SearchResponse,
  Invoice,
  ReconcileResult,
  DeliveryStatus,
  OverviewStats,
} from '../models/invoice.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  /** NLP natural-language search */
  search(query: string): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.base}/search`, { query });
  }

  /** Full invoice detail by id or invoice number */
  getInvoice(idOrNumber: string): Observable<Invoice> {
    return this.http.get<Invoice>(
      `${this.base}/invoices/${encodeURIComponent(idOrNumber)}`
    );
  }

  /** Reconciliation — compare PDF/XLS/DB/Index totals */
  getReconciliation(invoiceId: string): Observable<ReconcileResult> {
    return this.http.get<ReconcileResult>(
      `${this.base}/mcp/reconcile/compare/${encodeURIComponent(invoiceId)}`
    );
  }

  /** Delivery audit trail */
  getDeliveryStatus(invoiceId: string): Observable<DeliveryStatus> {
    return this.http.get<DeliveryStatus>(
      `${this.base}/mcp/audit/delivery_status/${encodeURIComponent(invoiceId)}`
    );
  }

  /** System-wide overview statistics */
  getOverview(): Observable<OverviewStats> {
    return this.http.get<OverviewStats>(`${this.base}/stats/overview`);
  }

  /** Status breakdown counts */
  getStatusBreakdown(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      `${this.base}/stats/status_breakdown`
    );
  }
}
