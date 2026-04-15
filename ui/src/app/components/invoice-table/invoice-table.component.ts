import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, signal, computed,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { InvoiceSummary } from '../../models/invoice.model';
import { MoneyPipe } from '../../pipes/money.pipe';
import { FmtDatePipe } from '../../pipes/fmt-date.pipe';

type SortKey = keyof InvoiceSummary;

interface ColDef {
  key: SortKey;
  label: string;
  align?: 'right';
  mono?: boolean;
}

const COLS: ColDef[] = [
  { key: 'invoice_number',     label: 'Invoice #' },
  { key: 'creation_date',      label: 'Created',      mono: true },
  { key: 'delivered_date',     label: 'Delivered',    mono: true },
  { key: 'amount_total',       label: 'Total',        align: 'right', mono: true },
  { key: 'amount_due',         label: 'Amount Due',   align: 'right', mono: true },
  { key: 'status',             label: 'Status' },
  { key: 'settlements_count',  label: 'Settlements',  align: 'right', mono: true },
  { key: 'charge_items_total', label: 'Charge Total', align: 'right', mono: true },
  { key: 'format_type',        label: 'Format' },
];

@Component({
  selector: 'app-invoice-table',
  standalone: true,
  imports: [NgClass, MoneyPipe, FmtDatePipe],
  templateUrl: './invoice-table.component.html',
  styleUrls: ['./invoice-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceTableComponent {
  @Input() set results(v: InvoiceSummary[]) { this._results.set(v); }
  @Input() selectedId: string | null = null;
  @Output() rowSelect = new EventEmitter<string>();

  readonly cols = COLS;
  readonly _results = signal<InvoiceSummary[]>([]);

  sortKey  = signal<SortKey>('creation_date');
  sortDir  = signal<1 | -1>(-1);

  sorted = computed(() => {
    const data = [...this._results()];
    const key  = this.sortKey();
    const dir  = this.sortDir();
    return data.sort((a, b) => {
      const av = a[key] as string | number | null;
      const bv = b[key] as string | number | null;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return av.localeCompare(String(bv)) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  });

  sort(key: SortKey): void {
    if (this.sortKey() === key) this.sortDir.update(d => (d === 1 ? -1 : 1));
    else { this.sortKey.set(key); this.sortDir.set(-1); }
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === -1 ? ' ↓' : ' ↑';
  }

  select(id: string): void { this.rowSelect.emit(id); }

  /* ── helpers used in template ───────────────────── */
  statusClass(status: string): string { return `badge badge-${status}`; }
  formatClass(fmt: string): string { return `chip chip-${fmt.toLowerCase()}`; }

  statusDot(status: string): string {
    const dots: Record<string, string> = {
      paid: '●', pending: '○', overdue: '▲', disputed: '◆', cancelled: '✕',
    };
    return dots[status] ?? '●';
  }
}
