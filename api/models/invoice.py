from pydantic import BaseModel
from typing import Optional, List
from datetime import date

class ChargeItem(BaseModel):
    item_id: str
    description: str
    quantity: float
    unit_rate: float
    amount: float
    category: str  # freight | surcharge | accessorial | insurance | other

class Settlement(BaseModel):
    settlement_id: str
    amount: float
    date: str
    method: str  # ACH | Wire | Check | Credit
    reference: str
    status: str  # cleared | pending | failed

class Invoice(BaseModel):
    id: str
    invoice_number: str
    customer_name: str
    vendor_name: str
    origin: str
    destination: str
    creation_date: str
    delivered_date: Optional[str]
    amount_total: float
    amount_due: float
    status: str  # paid | pending | overdue | disputed | cancelled
    format_type: str  # Detail | Summary
    charge_items: List[ChargeItem]
    settlements: List[Settlement]
    tracking_number: str
    notes: Optional[str]

class InvoiceSummary(BaseModel):
    id: str
    invoice_number: str
    customer_name: str
    vendor_name: str
    creation_date: str
    delivered_date: Optional[str]
    amount_total: float
    amount_due: float
    status: str
    format_type: str
    settlements_count: int
    charge_items_total: float

class SearchFilters(BaseModel):
    invoice_number: Optional[str] = None
    status: Optional[str] = None
    customer: Optional[str] = None
    format_type: Optional[str] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    sort: Optional[str] = "newest"

class SearchResponse(BaseModel):
    query: str
    filters_used: SearchFilters
    results: List[InvoiceSummary]
    total_count: int
    agent_response: str
    stats: dict
