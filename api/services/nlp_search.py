"""
NLP Search Service
Parses natural language queries into structured filters
and generates agent-style response text.
"""
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

# ── Customer name aliases ────────────────────────────────────────────────────
CUSTOMER_ALIASES = {
    "acme logistics": "Acme Logistics",
    "acme": "Acme Logistics",
    "pacific freight co": "Pacific Freight Co",
    "pacific freight": "Pacific Freight Co",
    "pacific": "Pacific Freight Co",
    "global shipping inc": "Global Shipping Inc",
    "global shipping": "Global Shipping Inc",
    "global": "Global Shipping Inc",
    "atlas transport": "Atlas Transport",
    "atlas": "Atlas Transport",
    "summit carriers": "Summit Carriers",
    "summit": "Summit Carriers",
    "blue ridge freight": "Blue Ridge Freight",
    "blue ridge": "Blue Ridge Freight",
    "fasttrack delivery": "FastTrack Delivery",
    "fasttrack": "FastTrack Delivery",
    "fast track": "FastTrack Delivery",
    "coastal express": "Coastal Express",
    "coastal": "Coastal Express",
}

# ── Status keyword mappings ──────────────────────────────────────────────────
STATUS_KEYWORDS = {
    "paid": ["paid", "completed", "settled", "cleared", "paid off"],
    "pending": ["pending", "outstanding", "unpaid", "due", "awaiting payment", "open"],
    "overdue": ["overdue", "late", "past due", "delinquent", "overdue", "missed"],
    "disputed": ["disputed", "dispute", "contested", "in dispute", "challenged"],
    "cancelled": ["cancelled", "canceled", "void", "voided", "terminated"],
}

# ── Month name mappings ──────────────────────────────────────────────────────
MONTH_NAMES = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}


def parse_query(query: str) -> Dict[str, Any]:
    """
    Parse a natural language query into structured filters.
    Returns a dict of filter fields.
    """
    q = query.lower().strip()
    filters: Dict[str, Any] = {}

    # 1. Invoice number pattern (INV-2024-XXX or partial)
    inv_match = re.search(r'inv[-\s]?2024[-\s]?(\d{1,3})', q, re.IGNORECASE)
    if inv_match:
        num = inv_match.group(1).zfill(3)
        filters["invoice_number"] = f"INV-2024-{num}"

    # 2. Status detection (first match wins)
    for status, keywords in STATUS_KEYWORDS.items():
        if any(kw in q for kw in keywords):
            filters["status"] = status
            break

    # 3. Customer name detection (longest match wins)
    matched_customer = None
    matched_len = 0
    for alias, canonical in CUSTOMER_ALIASES.items():
        if alias in q and len(alias) > matched_len:
            matched_customer = canonical
            matched_len = len(alias)
    if matched_customer:
        filters["customer"] = matched_customer

    # 4. Format type
    if re.search(r'\bdetail\b', q) and ("format" in q or "type" in q or "invoice" in q):
        filters["format_type"] = "Detail"
    elif re.search(r'\bdetailed?\b', q):
        filters["format_type"] = "Detail"
    elif re.search(r'\bsummary\b', q):
        filters["format_type"] = "Summary"

    # 5. Amount filters
    over_match = re.search(
        r'(?:over|above|more than|greater than|exceeding)\s+\$?([\d,]+)', q)
    under_match = re.search(
        r'(?:under|below|less than|lower than)\s+\$?([\d,]+)', q)
    between_match = re.search(
        r'between\s+\$?([\d,]+)\s+and\s+\$?([\d,]+)', q)

    if between_match:
        filters["amount_min"] = float(between_match.group(1).replace(",", ""))
        filters["amount_max"] = float(between_match.group(2).replace(",", ""))
    elif over_match:
        filters["amount_min"] = float(over_match.group(1).replace(",", ""))
    elif under_match:
        filters["amount_max"] = float(under_match.group(1).replace(",", ""))

    # 6. Date filters
    now = datetime(2024, 10, 15)  # fixed reference point for demo data
    if "this week" in q:
        week_start = now - timedelta(days=now.weekday())
        filters["date_from"] = week_start.strftime("%Y-%m-%d")
        filters["date_to"] = now.strftime("%Y-%m-%d")
    elif "last week" in q:
        week_end = now - timedelta(days=now.weekday() + 1)
        week_start = week_end - timedelta(days=6)
        filters["date_from"] = week_start.strftime("%Y-%m-%d")
        filters["date_to"] = week_end.strftime("%Y-%m-%d")
    elif "this month" in q:
        filters["date_from"] = now.strftime("%Y-%m-01")
        filters["date_to"] = now.strftime("%Y-%m-%d")
    elif "last month" in q:
        last = now.replace(day=1) - timedelta(days=1)
        filters["date_from"] = last.strftime("%Y-%m-01")
        filters["date_to"] = last.strftime("%Y-%m-%d")
    elif re.search(r'\bq1\b', q):
        filters["date_from"] = "2024-01-01"
        filters["date_to"] = "2024-03-31"
    elif re.search(r'\bq2\b', q):
        filters["date_from"] = "2024-04-01"
        filters["date_to"] = "2024-06-30"
    elif re.search(r'\bq3\b', q):
        filters["date_from"] = "2024-07-01"
        filters["date_to"] = "2024-09-30"
    elif re.search(r'\bq4\b', q):
        filters["date_from"] = "2024-10-01"
        filters["date_to"] = "2024-12-31"
    else:
        for month_name, month_num in MONTH_NAMES.items():
            if re.search(rf'\b{month_name}\b', q):
                filters["date_from"] = f"2024-{month_num:02d}-01"
                # Last day of month
                if month_num == 12:
                    filters["date_to"] = "2024-12-31"
                else:
                    next_m = datetime(2024, month_num + 1, 1)
                    filters["date_to"] = (next_m - timedelta(days=1)).strftime("%Y-%m-%d")
                break

    # 7. Sort order
    if any(w in q for w in ["recent", "latest", "newest"]):
        filters["sort"] = "newest"
    elif any(w in q for w in ["oldest", "earliest", "first"]):
        filters["sort"] = "oldest"
    elif any(w in q for w in ["highest", "largest", "most expensive"]):
        filters["sort"] = "amount_desc"
    elif any(w in q for w in ["lowest", "smallest", "cheapest"]):
        filters["sort"] = "amount_asc"
    else:
        filters["sort"] = "newest"

    return filters


def apply_filters(invoices: List[Dict], filters: Dict[str, Any]) -> List[Dict]:
    """Apply parsed filters to the invoice list."""
    results = invoices[:]

    if filters.get("invoice_number"):
        results = [i for i in results if filters["invoice_number"].upper() in i["invoice_number"].upper()]

    if filters.get("status"):
        results = [i for i in results if i["status"] == filters["status"]]

    if filters.get("customer"):
        cust = filters["customer"].lower()
        results = [i for i in results if cust in i["customer_name"].lower()]

    if filters.get("format_type"):
        results = [i for i in results if i["format_type"] == filters["format_type"]]

    if filters.get("amount_min") is not None:
        results = [i for i in results if i["amount_total"] >= filters["amount_min"]]

    if filters.get("amount_max") is not None:
        results = [i for i in results if i["amount_total"] <= filters["amount_max"]]

    if filters.get("date_from"):
        results = [i for i in results if i["creation_date"] >= filters["date_from"]]

    if filters.get("date_to"):
        results = [i for i in results if i["creation_date"] <= filters["date_to"]]

    # Sorting
    sort = filters.get("sort", "newest")
    if sort == "newest":
        results.sort(key=lambda x: x["creation_date"], reverse=True)
    elif sort == "oldest":
        results.sort(key=lambda x: x["creation_date"])
    elif sort == "amount_desc":
        results.sort(key=lambda x: x["amount_total"], reverse=True)
    elif sort == "amount_asc":
        results.sort(key=lambda x: x["amount_total"])

    return results


def compute_stats(invoices: List[Dict]) -> Dict[str, Any]:
    """Compute aggregate stats over a list of invoices."""
    if not invoices:
        return {"count": 0, "total_amount": 0, "total_due": 0, "by_status": {}, "by_format": {}}

    total_amount = sum(i["amount_total"] for i in invoices)
    total_due = sum(i["amount_due"] for i in invoices)

    by_status: Dict[str, int] = {}
    for inv in invoices:
        s = inv["status"]
        by_status[s] = by_status.get(s, 0) + 1

    by_format: Dict[str, int] = {}
    for inv in invoices:
        f = inv["format_type"]
        by_format[f] = by_format.get(f, 0) + 1

    return {
        "count": len(invoices),
        "total_amount": total_amount,
        "total_due": total_due,
        "collected": total_amount - total_due,
        "by_status": by_status,
        "by_format": by_format,
    }


def generate_agent_response(query: str, filters: Dict, results: List[Dict], stats: Dict) -> str:
    """
    Generate a natural-language agent response describing the search results.
    """
    count = stats["count"]

    if count == 0:
        suggestions = []
        if filters.get("status"):
            suggestions.append("try removing the status filter")
        if filters.get("customer"):
            suggestions.append(f"check the spelling of '{filters['customer']}'")
        if filters.get("amount_min") or filters.get("amount_max"):
            suggestions.append("widen the amount range")
        suggestion_text = "; ".join(suggestions) if suggestions else "try a broader query"
        return (
            f"No invoices found matching your query.\n\n"
            f"Suggestion: {suggestion_text.capitalize()}. "
            f"You can also try **'show all invoices'** to see the full list."
        )

    # Build filter description
    filter_parts = []
    if filters.get("status"):
        filter_parts.append(f"**{filters['status']}** status")
    if filters.get("customer"):
        filter_parts.append(f"customer **{filters['customer']}**")
    if filters.get("format_type"):
        filter_parts.append(f"**{filters['format_type']}** format")
    if filters.get("amount_min") and filters.get("amount_max"):
        filter_parts.append(f"amount between **${filters['amount_min']:,.0f}** and **${filters['amount_max']:,.0f}**")
    elif filters.get("amount_min"):
        filter_parts.append(f"amount over **${filters['amount_min']:,.0f}**")
    elif filters.get("amount_max"):
        filter_parts.append(f"amount under **${filters['amount_max']:,.0f}**")
    if filters.get("date_from") and filters.get("date_to"):
        filter_parts.append(f"created **{filters['date_from']}** to **{filters['date_to']}**")
    if filters.get("invoice_number"):
        filter_parts.append(f"invoice **{filters['invoice_number']}**")

    filter_desc = ", ".join(filter_parts) if filter_parts else "all filters"
    noun = "invoice" if count == 1 else "invoices"

    lines = []

    if filter_parts:
        lines.append(f"Found **{count} {noun}** with {filter_desc}.")
    else:
        lines.append(f"Showing **all {count} {noun}** in the system.")

    # Financial summary
    total = stats["total_amount"]
    due = stats["total_due"]
    collected = stats["collected"]
    lines.append(
        f"Total value: **${total:,.2f}** — collected **${collected:,.2f}**, "
        f"outstanding **${due:,.2f}**"
    )

    # Status breakdown (only if multiple statuses)
    by_status = stats["by_status"]
    if len(by_status) > 1:
        status_desc = ", ".join(f"{v} {k}" for k, v in sorted(by_status.items()))
        lines.append(f"Status breakdown: {status_desc}")
    elif len(by_status) == 1:
        only_status = list(by_status.keys())[0]
        if only_status == "overdue":
            lines.append("⚠️ All results are **overdue** — immediate follow-up recommended.")
        elif only_status == "disputed":
            lines.append("⚠️ All results are **disputed** — review open tickets.")

    # Highlight notable items
    if count > 1:
        highest = max(results, key=lambda x: x["amount_total"])
        lines.append(
            f"Largest invoice: **{highest['invoice_number']}** for "
            f"**${highest['amount_total']:,.2f}** ({highest['customer_name']})"
        )

    return "\n\n".join(lines)
