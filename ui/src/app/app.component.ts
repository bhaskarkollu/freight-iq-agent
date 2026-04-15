import {
  Component, OnInit, signal, computed,
  ChangeDetectionStrategy, inject,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ApiService } from './services/api.service';
import {
  ChatMessage, InvoiceSummary, InvoiceStats, OverviewStats,
} from './models/invoice.model';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import { InvoiceTableComponent } from './components/invoice-table/invoice-table.component';
import { InvoiceDetailComponent } from './components/invoice-detail/invoice-detail.component';
import { MoneyPipe } from './pipes/money.pipe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    NgClass,
    ChatPanelComponent,
    InvoiceTableComponent,
    InvoiceDetailComponent,
    MoneyPipe,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private readonly api = inject(ApiService);

  /* ── Reactive state ────────────────────────────── */
  messages    = signal<ChatMessage[]>([]);
  results     = signal<InvoiceSummary[]>([]);
  stats       = signal<InvoiceStats | null>(null);
  overview    = signal<OverviewStats | null>(null);
  selectedId  = signal<string | null>(null);
  isSearching = signal(false);
  hasSearched = signal(false);
  apiStatus   = signal<'connecting' | 'ok' | 'error'>('connecting');
  query       = signal('');

  /* ── Derived ────────────────────────────────────── */
  statusCounts = computed(() => {
    const ov = this.overview();
    if (!ov) return [];
    return Object.entries(ov.by_status).map(([status, count]) => ({ status, count }));
  });

  overviewCards = computed(() => {
    const ov = this.overview();
    if (!ov) return [];
    return [
      { label: 'Total Invoices', value: String(ov.total_invoices),                  cls: 'accent' },
      { label: 'Total Value',    value: this.fmtShort(ov.total_amount),              cls: '' },
      { label: 'Amount Due',     value: this.fmtShort(ov.total_due),                 cls: ov.total_due > 0 ? 'red' : 'green' },
      { label: 'Collected',      value: this.fmtShort(ov.collected),                 cls: 'green' },
    ];
  });

  /* ── Status colour map ─────────────────────────── */
  readonly statusColors: Record<string, string> = {
    paid:      'var(--green)',
    pending:   'var(--blue)',
    overdue:   'var(--red)',
    disputed:  'var(--amber)',
    cancelled: 'var(--text-muted)',
  };

  ngOnInit(): void {
    this.api.getOverview().subscribe({
      next:  (data) => { this.overview.set(data); this.apiStatus.set('ok'); },
      error: ()     => { this.apiStatus.set('error'); },
    });
  }

  /* ── NLP Search ────────────────────────────────── */
  runSearch(q: string): void {
    if (!q.trim() || this.isSearching()) return;
    this.query.set('');
    this.isSearching.set(true);
    this.hasSearched.set(true);

    // Append user message + loading placeholder
    this.messages.update(msgs => [
      ...msgs,
      { role: 'user',  content: q },
      { role: 'agent', content: '', isLoading: true },
    ]);

    this.api.search(q).subscribe({
      next: (data) => {
        this.results.set(data.results);
        this.stats.set(data.stats);
        // Replace loading placeholder with real response
        this.messages.update(msgs => [
          ...msgs.slice(0, -1),
          {
            role: 'agent',
            content: data.agent_response,
            stats: data.stats,
            filters: data.filters_used,
          },
        ]);
        this.isSearching.set(false);
      },
      error: (err) => {
        this.messages.update(msgs => [
          ...msgs.slice(0, -1),
          { role: 'agent', content: `Search failed: ${err.message ?? 'API unreachable. Check containers.'}` },
        ]);
        this.isSearching.set(false);
      },
    });
  }

  /* ── Helpers ────────────────────────────────────── */
  fmtShort(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }

  fmt$(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  statusColor(s: string): string {
    return this.statusColors[s] ?? 'var(--text-muted)';
  }

  statsByStatus(): Array<[string, number]> {
    return Object.entries(this.stats()?.by_status ?? {});
  }


  readonly archLayers = [
    { name: 'Conversational UI',   color: 'var(--purple)', desc: 'Angular 17 standalone components — NLP query bar, chat panel, 9-column results table, tabbed detail drawer' },
    { name: 'Agentic Orchestration', color: 'var(--blue)',   desc: 'Intent classifier → Task planner → Tool router → Response synthesizer' },
    { name: 'MCP Servers',          color: 'var(--accent)', desc: 'Invoice MCP, Settlement MCP, Delivery MCP, Reconciliation MCP, Vendor MCP, Audit Log MCP' },
    { name: 'Skills & Tools',       color: 'var(--green)',  desc: 'NLPSearchSkill, MismatchDetectorSkill, RootCauseSkill, PDF/XLS/DB/Index tools' },
    { name: 'Data Sources',         color: 'var(--text-secondary)', desc: 'PostgreSQL · S3 Documents · Elasticsearch · Settlement APIs · Audit Store' },
    { name: 'Issue Detection',      color: 'var(--red)',    desc: 'Generation issues · Delivery failures · Total mismatches · Charge disputes' },
  ];
  selectInvoice(id: string): void { this.selectedId.set(id); }
  closeDrawer(): void             { this.selectedId.set(null); }
  setQuery(q: string): void       { this.query.set(q); }
}
