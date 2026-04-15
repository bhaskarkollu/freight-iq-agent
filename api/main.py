"""
FreightAI — Conversational Invoice Intelligence API
FastAPI backend with NLP search, MCP-style endpoints, and invoice CRUD.
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from data.dummy_data import INVOICES
from services.nlp_search import parse_query, apply_filters, compute_stats, generate_agent_response

app = FastAPI(
    title="Customer Invoice Intelligence API",
    description="Conversational NLP search over customer invoices with MCP-style tool endpoints",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def to_summary(inv: dict) -> dict:
    """Convert a full invoice dict to the summary view."""
    charge_total = sum(ci["amount"] for ci in inv["charge_items"])
    return {
        "id": inv["id"],
        "invoice_number": inv["invoice_number"],
        "customer_name": inv["customer_name"],
        "vendor_name": inv["vendor_name"],
        "creation_date": inv["creation_date"],
        "delivered_date": inv["delivered_date"],
        "amount_total": inv["amount_total"],
        "amount_due": inv["amount_due"],
        "status": inv["status"],
        "format_type": inv["format_type"],
        "settlements_count": len(inv["settlements"]),
        "charge_items_total": charge_total,
        "tracking_number": inv["tracking_number"],
        "origin": inv["origin"],
        "destination": inv["destination"],
        "notes": inv.get("notes"),
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "FreightAI API", "invoices_loaded": len(INVOICES)}


# ── Core Search (NLP) ─────────────────────────────────────────────────────────

@app.post("/api/search")
def nlp_search(payload: dict):
    """
    NLP search endpoint — accepts a natural language query,
    returns matched invoices + agent response.
    """
    query = payload.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    filters = parse_query(query)
    matched = apply_filters(INVOICES, filters)
    stats = compute_stats(matched)
    agent_response = generate_agent_response(query, filters, matched, stats)

    return {
        "query": query,
        "filters_used": filters,
        "results": [to_summary(inv) for inv in matched],
        "total_count": len(matched),
        "agent_response": agent_response,
        "stats": stats,
    }


# ── Invoice CRUD ──────────────────────────────────────────────────────────────

@app.get("/api/invoices")
def list_invoices(
    status: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    format_type: Optional[str] = Query(None),
    sort: Optional[str] = Query("newest"),
    limit: int = Query(50, le=100),
):
    """List all invoices with optional filters."""
    filters = {}
    if status:
        filters["status"] = status
    if customer:
        filters["customer"] = customer
    if format_type:
        filters["format_type"] = format_type
    filters["sort"] = sort

    results = apply_filters(INVOICES, filters)
    return {
        "results": [to_summary(inv) for inv in results[:limit]],
        "total_count": len(results),
        "stats": compute_stats(results),
    }


@app.get("/api/invoices/{invoice_id}")
def get_invoice(invoice_id: str):
    """Get full invoice detail by ID or invoice number."""
    inv = next(
        (i for i in INVOICES
         if i["id"] == invoice_id or i["invoice_number"].upper() == invoice_id.upper()),
        None,
    )
    if not inv:
        raise HTTPException(status_code=404, detail=f"Invoice '{invoice_id}' not found")
    return inv


# ── MCP-Style Tool Endpoints ──────────────────────────────────────────────────
# These simulate the MCP server interface described in the architecture.

@app.post("/api/mcp/invoice/search_invoices")
def mcp_search_invoices(payload: dict):
    """MCP tool: search_invoices — structured filter search."""
    filters = {k: v for k, v in payload.items() if v is not None}
    results = apply_filters(INVOICES, filters)
    return {
        "tool": "search_invoices",
        "results": [to_summary(inv) for inv in results],
        "count": len(results),
    }


@app.get("/api/mcp/invoice/get_invoice/{invoice_id}")
def mcp_get_invoice(invoice_id: str):
    """MCP tool: get_invoice_by_id."""
    return get_invoice(invoice_id)


@app.get("/api/mcp/settlement/list_settlements/{invoice_id}")
def mcp_list_settlements(invoice_id: str):
    """MCP tool: list settlements for an invoice."""
    inv = next(
        (i for i in INVOICES
         if i["id"] == invoice_id or i["invoice_number"].upper() == invoice_id.upper()),
        None,
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {
        "tool": "list_settlements",
        "invoice_number": inv["invoice_number"],
        "settlements": inv["settlements"],
        "count": len(inv["settlements"]),
        "total_settled": sum(s["amount"] for s in inv["settlements"]),
    }


@app.get("/api/mcp/charge/list_charge_items/{invoice_id}")
def mcp_list_charge_items(invoice_id: str):
    """MCP tool: list charge items for an invoice."""
    inv = next(
        (i for i in INVOICES
         if i["id"] == invoice_id or i["invoice_number"].upper() == invoice_id.upper()),
        None,
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    total = sum(ci["amount"] for ci in inv["charge_items"])
    return {
        "tool": "list_charge_items",
        "invoice_number": inv["invoice_number"],
        "charge_items": inv["charge_items"],
        "count": len(inv["charge_items"]),
        "total": total,
        "vs_invoice_total": {
            "invoice_total": inv["amount_total"],
            "charge_total": total,
            "delta": inv["amount_total"] - total,
            "match": abs(inv["amount_total"] - total) < 0.01,
        },
    }


@app.get("/api/mcp/reconcile/compare/{invoice_id}")
def mcp_reconcile(invoice_id: str):
    """MCP tool: compare_invoice_sources — simulate PDF/XLS/DB/Index mismatch detection."""
    inv = next(
        (i for i in INVOICES
         if i["id"] == invoice_id or i["invoice_number"].upper() == invoice_id.upper()),
        None,
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    charge_total = sum(ci["amount"] for ci in inv["charge_items"])

    # Simulate slight discrepancies in PDF/XLS/Index for demo purposes
    import hashlib
    seed = int(hashlib.md5(invoice_id.encode()).hexdigest()[:4], 16)
    pdf_delta = ((seed % 3) - 1) * (seed % 100) * 0.10
    xls_delta = ((seed % 5) - 2) * (seed % 50) * 0.05
    idx_delta = 0.0  # Index usually matches DB

    db_total = inv["amount_total"]
    pdf_total = round(db_total + pdf_delta, 2)
    xls_total = round(db_total + xls_delta, 2)
    index_total = round(db_total + idx_delta, 2)

    sources = {
        "PDF": pdf_total,
        "XLS": xls_total,
        "DB": db_total,
        "Index": index_total,
    }
    mismatches = {k: v for k, v in sources.items() if abs(v - db_total) > 0.01}

    return {
        "tool": "compare_invoice_sources",
        "invoice_number": inv["invoice_number"],
        "sources": sources,
        "charge_items_total": charge_total,
        "has_mismatch": len(mismatches) > 0,
        "mismatched_sources": mismatches,
        "issues": [
            {"source": k, "delta": round(v - db_total, 2), "severity": "warning" if abs(v - db_total) < 100 else "error"}
            for k, v in mismatches.items()
        ],
    }


# ── Audit / Diagnostic Endpoints ──────────────────────────────────────────────

@app.get("/api/mcp/audit/delivery_status/{invoice_id}")
def mcp_delivery_status(invoice_id: str):
    """MCP tool: get_delivery_status — simulated delivery audit trail."""
    inv = next(
        (i for i in INVOICES
         if i["id"] == invoice_id or i["invoice_number"].upper() == invoice_id.upper()),
        None,
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    events = []
    created = inv["creation_date"]

    events.append({"event": "invoice_generated", "date": created, "status": "success", "detail": "Invoice rendered from template"})
    events.append({"event": "email_dispatch", "date": created, "status": "success", "detail": f"Sent to billing@{inv['customer_name'].lower().replace(' ', '')}.com"})

    if inv["status"] == "overdue":
        events.append({"event": "email_delivery", "date": created, "status": "bounced", "detail": "Bounce: 550 Mailbox does not exist"})
        events.append({"event": "retry_1", "date": created, "status": "failed", "detail": "Retry failed — same bounce code"})
        events.append({"event": "escalation_notice", "date": created, "status": "sent", "detail": "Escalation email sent to account manager"})
    elif inv["status"] == "disputed":
        events.append({"event": "email_delivery", "date": created, "status": "delivered", "detail": "Delivered — read receipt received"})
        events.append({"event": "dispute_raised", "date": inv.get("delivered_date", created), "status": "open", "detail": f"Dispute ticket created: {inv.get('notes','')[:60]}"})
    elif inv["status"] == "cancelled":
        events.append({"event": "email_delivery", "date": created, "status": "delivered", "detail": "Delivered successfully"})
        events.append({"event": "cancellation", "date": created, "status": "cancelled", "detail": inv.get("notes", "Cancelled by customer")})
    elif inv["delivered_date"]:
        events.append({"event": "email_delivery", "date": created, "status": "delivered", "detail": "Delivered successfully"})
        events.append({"event": "shipment_delivered", "date": inv["delivered_date"], "status": "success", "detail": f"Delivered to {inv['destination']}"})

    return {
        "tool": "get_delivery_status",
        "invoice_number": inv["invoice_number"],
        "current_status": inv["status"],
        "delivery_address": inv["destination"],
        "tracking_number": inv["tracking_number"],
        "events": events,
    }


# ── Aggregates ────────────────────────────────────────────────────────────────

@app.get("/api/stats/overview")
def stats_overview():
    """High-level statistics over all invoices."""
    stats = compute_stats(INVOICES)
    customers = {}
    for inv in INVOICES:
        c = inv["customer_name"]
        if c not in customers:
            customers[c] = {"count": 0, "total": 0.0}
        customers[c]["count"] += 1
        customers[c]["total"] += inv["amount_total"]

    return {
        **stats,
        "total_invoices": len(INVOICES),
        "by_customer": customers,
    }


@app.get("/api/stats/status_breakdown")
def status_breakdown():
    """Invoice counts and amounts broken down by status."""
    breakdown = {}
    for inv in INVOICES:
        s = inv["status"]
        if s not in breakdown:
            breakdown[s] = {"count": 0, "total_amount": 0.0, "total_due": 0.0}
        breakdown[s]["count"] += 1
        breakdown[s]["total_amount"] += inv["amount_total"]
        breakdown[s]["total_due"] += inv["amount_due"]
    return breakdown
