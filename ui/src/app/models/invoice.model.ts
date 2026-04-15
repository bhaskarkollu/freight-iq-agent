// ── Charge line item ────────────────────────────────────────
export interface ChargeItem {
  item_id: string;
  description: string;
  quantity: number;
  unit_rate: number;
  amount: number;
  category: 'freight' | 'surcharge' | 'accessorial' | 'insurance' | 'other';
}

// ── Settlement payment record ────────────────────────────────
export interface Settlement {
  settlement_id: string;
  amount: number;
  date: string;
  method: 'ACH' | 'Wire' | 'Check' | 'Credit';
  reference: string;
  status: 'cleared' | 'pending' | 'failed';
}

// ── Full invoice (detail view) ───────────────────────────────
export interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  vendor_name: string;
  origin: string;
  destination: string;
  creation_date: string;
  delivered_date: string | null;
  amount_total: number;
  amount_due: number;
  status: InvoiceStatus;
  format_type: FormatType;
  charge_items: ChargeItem[];
  settlements: Settlement[];
  tracking_number: string;
  notes: string | null;
}

// ── Summary row (table view — 9 display columns) ─────────────
export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  customer_name: string;
  vendor_name: string;
  creation_date: string;
  delivered_date: string | null;
  amount_total: number;
  amount_due: number;
  status: InvoiceStatus;
  format_type: FormatType;
  settlements_count: number;
  charge_items_total: number;
  tracking_number: string;
  origin: string;
  destination: string;
  notes: string | null;
}

// ── Enums / unions ───────────────────────────────────────────
export type InvoiceStatus = 'open' | 'paid' | 'pending' | 'overdue' | 'disputed' | 'cancelled';
export type FormatType = 'Detail' | 'Summary';

// ── NLP search response ──────────────────────────────────────
export interface SearchResponse {
  query: string;
  filters_used: Record<string, unknown>;
  results: InvoiceSummary[];
  total_count: number;
  agent_response: string;
  stats: InvoiceStats;
}

export interface InvoiceStats {
  count: number;
  total_amount: number;
  total_due: number;
  collected: number;
  by_status: Record<string, number>;
  by_format: Record<string, number>;
}

// ── Reconciliation comparison ────────────────────────────────
export interface ReconcileResult {
  tool: string;
  invoice_number: string;
  sources: { PDF: number; XLS: number; DB: number; Index: number };
  charge_items_total: number;
  has_mismatch: boolean;
  mismatched_sources: Record<string, number>;
  issues: Array<{ source: string; delta: number; severity: 'warning' | 'error' }>;
}

export type ReconcileSourceKey = keyof ReconcileResult['sources'];

// ── Delivery audit trail ─────────────────────────────────────
export interface DeliveryEvent {
  event: string;
  date: string;
  status: string;
  detail: string;
}

export interface DeliveryStatus {
  tool: string;
  invoice_number: string;
  current_status: InvoiceStatus;
  delivery_address: string;
  tracking_number: string;
  events: DeliveryEvent[];
}

// ── System overview stats ─────────────────────────────────────
export interface OverviewStats {
  count: number;
  total_amount: number;
  total_due: number;
  collected: number;
  total_invoices: number;
  by_status: Record<string, number>;
  by_customer: Record<string, { count: number; total: number }>;
}

// ── Chat message ─────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  isLoading?: boolean;
  stats?: InvoiceStats;
  filters?: Record<string, unknown>;
}

// ── Sort config ──────────────────────────────────────────────
export interface SortConfig {
  key: keyof InvoiceSummary;
  dir: 1 | -1;
}

// ── Table column definition ──────────────────────────────────
export interface TableColumn {
  key: keyof InvoiceSummary;
  label: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
}
