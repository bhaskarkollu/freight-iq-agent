import {
  Component, Input, Output, EventEmitter,
  ViewChild, ElementRef, AfterViewChecked,
  ChangeDetectionStrategy, OnChanges,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage, InvoiceStats } from '../../models/invoice.model';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

export const SUGGESTIONS = [
  'Show all invoices',
  'Overdue invoices',
  'Acme Logistics',
  'Paid over $10,000',
  'Disputed invoices',
  'Pending this month',
  'Summary format',
  'INV-2024-015',
  'Q3 invoices',
  'Pacific Freight',
  'Amount between 5000 and 15000',
  'Global Shipping overdue',
];

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [NgClass, FormsModule, MarkdownPipe],
  templateUrl: './chat-panel.component.html',
  styleUrls: ['./chat-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPanelComponent implements AfterViewChecked, OnChanges {
  @Input() messages: ChatMessage[] = [];
  @Input() isSearching = false;
  @Input() query = '';

  @Output() querySubmit = new EventEmitter<string>();
  @Output() queryChange = new EventEmitter<string>();

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;

  readonly suggestions = SUGGESTIONS;
  private shouldScroll = false;

  ngOnChanges(): void {
    this.shouldScroll = true;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }

  onQueryChange(val: string): void {
    this.queryChange.emit(val);
  }

  submit(): void {
    const q = this.query.trim();
    if (!q || this.isSearching) return;
    this.querySubmit.emit(q);
  }

  submitSuggestion(s: string): void {
    if (this.isSearching) return;
    this.querySubmit.emit(s);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submit();
    }
  }

  filterKeys(filters: Record<string, unknown> | undefined): string[] {
    if (!filters) return [];
    return Object.keys(filters).filter(k => k !== 'sort' && filters[k] != null && filters[k] !== '');
  }

  hasStats(msg: ChatMessage): msg is ChatMessage & { stats: InvoiceStats } {
    return !!msg.stats;
  }

  fmtDue(due: number): string {
    return `$${(due || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
}
