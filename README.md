# FreightAI — Angular 17 Invoice Intelligence Platform

Conversational AI-powered invoice search built with **Angular 17** (standalone
components, new `@if`/`@for` control flow, signals) and a **FastAPI** backend.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│           Angular 17 UI  (Standalone Components + Signals)          │
│                                                                     │
│  AppComponent (shell)                                               │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌───────────────┐  │
│  │  ChatPanelComponent│  │ InvoiceTableComponent│  │InvoiceDetail  │  │
│  │  NLP input        │  │ 9-column results     │  │Component      │  │
│  │  Message history  │  │ Sortable columns     │  │5 tabs:        │  │
│  │  Quick suggestions│  │ Click → drawer       │  │overview       │  │
│  │  Streaming state  │  │                      │  │charges        │  │
│  └──────────────────┘  └─────────────────────┘  │settlements    │  │
│                                                   │reconcile      │  │
│  Pipes: MoneyPipe · FmtDatePipe · MarkdownPipe    │delivery       │  │
│  Services: ApiService (HttpClient)                └───────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             │ Proxy /api/* → :8000
┌─────────────────────────────────────────────────────────────────────┐
│           FastAPI  (Python 3.11)                                    │
│                                                                     │
│  POST /api/search          ← NLP query engine                      │
│  GET  /api/invoices/:id    ← full invoice detail                   │
│  GET  /api/stats/overview  ← system-wide stats                     │
│  GET  /api/mcp/reconcile/compare/:id   ← PDF/XLS/DB/Index diff     │
│  GET  /api/mcp/audit/delivery_status/:id ← delivery timeline       │
│  GET  /api/mcp/settlement/list_settlements/:id                      │
│  GET  /api/mcp/charge/list_charge_items/:id                         │
└─────────────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────────────┐
│  In-memory data  (30 invoices, 8 customers, 5 vendors, 5 statuses) │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Angular 17 Features Used

| Feature | Usage |
|---|---|
| **Standalone components** | Every component, pipe, and directive is standalone — no NgModule |
| **New `@if` / `@for`** | All templates use Angular 17's built-in control flow syntax |
| **Signals** | `signal()`, `computed()`, `signal.update()` for all reactive state |
| **`inject()`** | Used throughout instead of constructor injection |
| **`ChangeDetectionStrategy.OnPush`** | Applied to all components for performance |
| **`forkJoin`** | Parallel HTTP calls in `InvoiceDetail` |
| **`HttpClient`** | Provided via `provideHttpClient()` in `bootstrapApplication` |

---

## Invoice Display — 9 Columns

| # | Column | Notes |
|---|---|---|
| 1 | **Invoice Number** | Orange mono font + customer sub-label |
| 2 | **Creation Date** | `Jan 10, 2024` via `FmtDatePipe` |
| 3 | **Delivered Date** | `—` if null |
| 4 | **Amount Total** | Right-aligned, `MoneyPipe` |
| 5 | **Amount Due** | Green `$0.00` · Red for balance |
| 6 | **Status** | Color badge: paid/pending/overdue/disputed/cancelled |
| 7 | **Settlements Count** | Green count · grey `—` if zero |
| 8 | **Charge Items Total** | Sum of all line items |
| 9 | **Format Type** | `DETAIL` / `SUMMARY` chip |

---

## Quick Start

```bash
chmod +x start.sh stop.sh
./start.sh
```

Open: **http://localhost:4200**

**Manual:**
```bash
podman compose up --build
```

**Stop:**
```bash
./stop.sh
```

`start.sh` prefers `podman compose`, then `podman-compose`, and falls back to Docker compose if Podman is not installed.

---

## Services

| Service | Port | URL |
|---|---|---|
| Angular UI | 4200 | http://localhost:4200 |
| FastAPI | 8000 | http://localhost:8000 |
| Swagger Docs | 8000 | http://localhost:8000/docs |

---

## NLP Query Examples

```
show all invoices
overdue invoices
paid invoices for Acme Logistics
disputed over $10,000
pending invoices in Q2
summary format invoices
INV-2024-015
Pacific Freight overdue
amount between 5000 and 15000
paid invoices in January
```

---

## Project Structure

```
freight-ai-angular/
├── docker-compose.yml
├── start.sh / stop.sh
├── README.md
│
├── api/                              ← FastAPI (Python 3.11)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                       ← routes + CORS + MCP endpoints
│   ├── data/dummy_data.py            ← 30 freight invoices
│   ├── models/invoice.py             ← Pydantic models
│   └── services/nlp_search.py        ← NLP parser + filter engine
│
└── ui/                               ← Angular 17
    ├── Dockerfile
    ├── angular.json
    ├── proxy.conf.json               ← /api → :8000
    ├── tsconfig.json
    ├── package.json
    └── src/
        ├── main.ts                   ← bootstrapApplication (no NgModule)
        ├── index.html
        ├── styles.css                ← global dark-theme design system
        └── app/
            ├── app.component.ts/html/css  ← root shell
            ├── models/
            │   └── invoice.model.ts       ← all TypeScript interfaces
            ├── services/
            │   └── api.service.ts         ← HttpClient wrapper
            ├── pipes/
            │   ├── money.pipe.ts          ← $12,345.00 formatter
            │   ├── fmt-date.pipe.ts       ← Jan 10, 2024 formatter
            │   └── markdown.pipe.ts       ← **bold** → <strong>
            └── components/
                ├── chat-panel/            ← NLP agent sidebar
                ├── invoice-table/         ← 9-column sortable grid
                └── invoice-detail/        ← 5-tab detail drawer
```
