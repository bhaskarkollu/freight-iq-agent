import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges, signal,
  ChangeDetectionStrategy, inject,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import {
  Invoice, ReconcileResult, DeliveryStatus, ChargeItem, Settlement, ReconcileSourceKey,
} from '../../models/invoice.model';
import { MoneyPipe } from '../../pipes/money.pipe';
import { FmtDatePipe } from '../../pipes/fmt-date.pipe';

type Tab = 'overview' | 'charges' | 'settlements' | 'reconcile' | 'delivery' | 'cause';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [NgClass, MoneyPipe, FmtDatePipe],
  templateUrl: './invoice-detail.component.html',
  styleUrls: ['./invoice-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetailComponent implements OnChanges {
  @Input() invoiceId: string | null = null;
  @Output() closeDrawer = new EventEmitter<void>();

  private readonly api = inject(ApiService);

  readonly tabs: Tab[] = ['overview', 'charges', 'settlements', 'reconcile', 'delivery', 'cause'];
  activeTab = signal<Tab>('overview');
  loading   = signal(false);

  inv      = signal<Invoice | null>(null);
  recon    = signal<ReconcileResult | null>(null);
  delivery = signal<DeliveryStatus | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['invoiceId'] && this.invoiceId) {
      this.load(this.invoiceId);
    }
  }

  private load(id: string): void {
    this.loading.set(true);
    this.inv.set(null);
    this.recon.set(null);
    this.delivery.set(null);
    this.activeTab.set('overview');

    forkJoin({
      inv:      this.api.getInvoice(id).pipe(catchError(() => of(null))),
      recon:    this.api.getReconciliation(id).pipe(catchError(() => of(null))),
      delivery: this.api.getDeliveryStatus(id).pipe(catchError(() => of(null))),
    }).subscribe(({ inv, recon, delivery }) => {
      this.inv.set(inv as Invoice);
      this.recon.set(recon as ReconcileResult);
      this.delivery.set(delivery as DeliveryStatus);
      const tab: Tab = inv?.status === 'open' ? 'cause' : 'overview';
      this.activeTab.set(tab);
      this.loading.set(false);
    });
  }

  setTab(t: Tab): void { this.activeTab.set(t); }
  close(): void { this.closeDrawer.emit(); }

  /* ── Template helpers ─────────────────────── */
  chargeTotal(items: ChargeItem[]): number {
    return items.reduce((s, c) => s + c.amount, 0);
  }
  settleTotal(sets: Settlement[]): number {
    return sets.reduce((s, x) => s + x.amount, 0);
  }

  sourceDelta(val: number, db: number): number {
    return Math.round((val - db) * 100) / 100;
  }
  hasDelta(val: number, db: number): boolean {
    return Math.abs(val - db) > 0.01;
  }

  eventDotClass(status: string): string {
    if (['success', 'cleared', 'delivered', 'sent'].includes(status))
      return 'dot-green';
    if (['failed', 'bounced'].includes(status))
      return 'dot-red';
    if (['open', 'cancelled'].includes(status))
      return 'dot-amber';
    return 'dot-muted';
  }

  categoryClass(cat: string): string {
    const map: Record<string, string> = {
      freight: 'cat-freight',
      surcharge: 'cat-surcharge',
      insurance: 'cat-insurance',
      accessorial: 'cat-accessorial',
    };
    return map[cat] ?? 'cat-other';
  }

  settleStatusColor(status: string): string {
    return status === 'cleared' ? 'var(--green)'
         : status === 'failed'  ? 'var(--red)'
         : 'var(--amber)';
  }

  sourceKeys(sources: ReconcileResult['sources']): ReconcileSourceKey[] {
    return Object.keys(sources) as ReconcileSourceKey[];
  }

  sourceValue(sources: ReconcileResult['sources'], key: ReconcileSourceKey): number {
    return sources[key];
  }

  onOverlayClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains('drawer-overlay')) {
      this.close();
    }
  }

  private hasValidationError(recon: ReconcileResult | null): boolean {
    return !!recon?.issues?.some(issue => /validated|validation|minimum/i.test(issue.source) || issue.severity === 'error');
  }

  private isTotalMismatch(inv: Invoice, recon: ReconcileResult | null): boolean {
    if (Math.abs(inv.amount_total - this.chargeTotal(inv.charge_items)) > 0.01) return true;
    if (recon?.sources?.Index != null && Math.abs(inv.amount_total - recon.sources.Index) > 0.01) return true;
    return false;
  }

  private hasSettlementMismatch(recon: ReconcileResult | null): boolean {
    return !!recon?.has_mismatch;
  }

  issueCategory(): 'Settlement Mismatch' | 'Totals Mismatch' | 'Customer Validation Errors' | 'System Exceptions' {
    const inv = this.inv();
    const recon = this.recon();

    if (!inv || inv.status !== 'open') {
      return 'System Exceptions';
    }
    if (this.hasValidationError(recon)) {
      return 'Customer Validation Errors';
    }
    if (this.isTotalMismatch(inv, recon)) {
      return 'Totals Mismatch';
    }
    if (this.hasSettlementMismatch(recon)) {
      return 'Settlement Mismatch';
    }
    return 'System Exceptions';
  }

  issueDetails(): string[] {
    switch (this.issueCategory()) {
      case 'Settlement Mismatch':
        return [
          'Settlement mismatch between Customer Invoice and Invoice Charges (tables).',
          'Settlement mismatch between the index and the customer invoice.',
        ];
      case 'Totals Mismatch':
        return [
          'Total mismatch between Customer Invoice and Invoice Charges.',
          'Total mismatch between Customer Invoice and Index.',
        ];
      case 'Customer Validation Errors':
        return [
          'Minimum Total not met.',
          'No VALIDATED charges from Invoice Charges.',
        ];
      default:
        return [
          'Point to Datadog link to exception trace.',
          'Exception details are available in the system logs.',
        ];
    }
  }

  issueFixes(): string[] {
    switch (this.issueCategory()) {
      case 'Settlement Mismatch':
        return [
          'Reconcile the Customer Invoice and Invoice Charges settlement tables.',
          'Verify index totals and align the customer invoice with the correct settlement records.',
        ];
      case 'Totals Mismatch':
        return [
          'Confirm invoice line item totals and correct any charge entry errors.',
          'Ensure the Customer Invoice total matches the Index total and invoice charges.',
        ];
      case 'Customer Validation Errors':
        return [
          'Review validation rules and update charges so valid items are included.',
          'Correct minimum total or validated charge requirements before reprocessing.',
        ];
      default:
        return [
          'Open the Datadog trace for the invoice exception.',
          'Review the exception details, then resolve the underlying data or service failure.',
        ];
    }
  }

  datadogLink(): string {
    return `https://app.datadoghq.com/logs?query=${encodeURIComponent(this.inv()?.invoice_number ?? '')}`;
  }
}
