# DukaanPro — Enterprise Multi-Tenant Retail POS & Inventory SaaS

[![Next.js 16](https://img.shields.io/badge/Next.js-16.2.1-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2.4-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=for-the-badge&logo=postgresql)](https://supabase.com/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Playwright E2E](https://img.shields.io/badge/Playwright-Stress_Tested-45ba4b?style=for-the-badge&logo=playwright)](https://playwright.dev/)

> **DukaanPro** is a production-grade, multi-tenant Point of Sale (POS), Inventory Management, and B2B Billing SaaS platform engineered specifically for high-throughput supermarkets, wholesale distributors, and retail enterprises in Somaliland and emerging African markets.

---

## 🌟 Architectural Highlights & Core Mission

Retail enterprises in emerging markets face unique operational challenges: volatile multi-currency dynamics (USD pricing settled in Somaliland Shillings), pervasive mobile money reliance (ZAAD, eDahab, EVC Plus), high-frequency hardware barcode scanning, and intermittent connectivity.

DukaanPro addresses these realities with an offline-resilient, sub-millisecond web architecture backed by enterprise database guarantees:

1. **Sub-Millisecond Rapid POS Checkout:** Zero-latency barcode scanning backed by an in-memory dual-indexed lookup cache and sequential queuing.
2. **PostgreSQL Concurrency Guarantees:** Pessimistic row-level locking (`FOR UPDATE`) inside an atomic checkout RPC prevents overselling across parallel checkout lanes.
3. **Carton-to-Unit Auto-Breakdown:** Algorithmic stock deconsolidation automatically unpacks bulk cases when individual loose units run out during a sale.
4. **Hardware-Agnostic Retail Peripherals:** Seamless integration with physical USB/Bluetooth HID handheld scanners, mobile cameras, and 58mm/80mm thermal receipt printers without proprietary drivers.
5. **Strict Multi-Tenant Isolation:** Complete logical tenant separation across 18 relational tables via PostgreSQL Row Level Security (RLS) policies.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT TIER (POS / PWA)                              │
│                                                                                        │
│   ┌───────────────────────────┐    ┌───────────────────────────┐    ┌────────────────┐ │
│   │ Hardware HID Scanner      │    │ Optical Camera Scanner    │    │ Web Audio API  │ │
│   │ (USB / Bluetooth Keystroke)│   │ (Html5Qrcode 1D/2D Reader)│    │ (950Hz Synthesizer)│
│   └─────────────┬─────────────┘    └─────────────┬─────────────┘    └────────┬───────┘ │
│                 │                                │                           │         │
│                 ▼                                ▼                           │         │
│   ┌────────────────────────────────────────────────────────────┐             │         │
│   │ useBarcodeScanner Hook (Autofocus Preservation Daemon)      │             │         │
│   └─────────────────────────────┬──────────────────────────────┘             │         │
│                                 ▼                                            │         │
│   ┌────────────────────────────────────────────────────────────┐             │         │
│   │ barcodeService (In-Memory Map Cache + Sequential Queue)    │◄────────────┘         │
│   └─────────────────────────────┬──────────────────────────────┘                       │
└─────────────────────────────────┼──────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION TIER (Next.js 16)                             │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ src/proxy.ts (Next.js 16 Edge Session & Authentication Middleware)            │   │
│   └──────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                          │                                             │
│                 ┌────────────────────────┴────────────────────────┐                    │
│                 ▼                                                 ▼                    │
│   ┌───────────────────────────┐                     ┌───────────────────────────┐      │
│   │ Next.js App Router (16.2) │                     │ /api/products/barcode/    │      │
│   │ Dashboard & Cashier POS   │                     │ High-Throughput Lookup    │      │
│   └─────────────┬─────────────┘                     └─────────────┬─────────────┘      │
└─────────────────┼─────────────────────────────────────────────────┼────────────────────┘
                  │                                                 │
                  ▼                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA & SECURITY TIER (Supabase)                           │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ PostgreSQL 15+ with Row Level Security (RLS) on 18 Tables                      │   │
│   │ USING (tenant_id IN (SELECT public.get_user_tenant_ids()))                     │   │
│   └──────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                          │                                             │
│                 ┌────────────────────────┴────────────────────────┐                    │
│                 ▼                                                 ▼                    │
│   ┌───────────────────────────────────────┐     ┌──────────────────────────────────┐   │
│   │ process_pos_checkout() RPC            │     │ Auto-Breakdown Engine            │   │
│   │ • Atomic single-transaction commit    │     │ • Parent carton deduction        │   │
│   │ • Pessimistic row locking (FOR UPDATE)│     │ • Automated piece-ratio unpacking│   │
│   │ • Customer debt ledger adjustment     │     │ • Rollback on double depletion   │   │
│   └───────────────────────────────────────┘     └──────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Core Engineering Modules

### 1. Dual-Engine Barcode Architecture
* **Hardware USB/Bluetooth HID Scanner Listener:** Standard handheld barcode guns simulate keyboards by dumping characters rapidly followed by an `Enter` keystroke. DukaanPro's [`useBarcodeScanner`](src/hooks/useBarcodeScanner.ts) hook runs a 1,500ms background focus maintenance daemon that silently restores cursor focus to a hidden input without interrupting cashiers while typing inside form inputs, textareas, or modal dialogs.
* **Camera Optical Scanning:** Powered by [`BarcodeScannerCamera.tsx`](src/components/BarcodeScannerCamera.tsx) using `Html5Qrcode`, supporting multi-camera device switching (`facingMode: "environment"`), 2,000ms scan debouncing, and localized Somali/English camera permission alerts.
* **Sub-Millisecond In-Memory Caching:** [`barcode-service.ts`](src/lib/barcode/barcode-service.ts) indexes catalog items by both Barcode and SKU in a `Map<string, BarcodeProduct>` for **<1ms** instant additions to the cart, with sequential `Promise` queuing to eliminate race conditions during high-speed supermarket scanning.
* **Synthesized Web Audio Feedback:** [`scanner-audio.ts`](src/lib/barcode/scanner-audio.ts) uses the native browser Web Audio API (`AudioContext`) to generate zero-latency 950Hz sine wave scanner confirmation beeps and dual-tone error sounds with dynamic gain ramps, requiring zero external MP3 assets.
* **GS1 Check Digit Calculation:** [`barcode-utils.ts`](src/lib/barcode/barcode-utils.ts) includes the mathematical EAN-13 check digit calculator (odd/even alternating weights % 10) and store internal code generator (GS1 prefix `20`).

### 2. Multi-Channel Receipt Printing Suite
* **ESC/POS 58mm / 80mm Direct Thermal Printing:** Engineered directly in [`src/app/globals.css`](src/app/globals.css) via `@media print`. Uses `.print-target` DOM isolation, margin suppression (`@page { margin: 0; size: auto }`), background suppression, and `page-break-inside: avoid` to print cleanly from any standard thermal roll printer via `window.print()`.
* **Social WhatsApp Digital Slips:** Generates 380px high-resolution PNG receipt cards via `html-to-image` at 3x pixel ratio, ready to be saved and dispatched via WhatsApp or SMS to customers.
* **Vector A4 B2B Invoices:** Client-side vector-aligned PDF generation via `jspdf` for wholesale and corporate accounts.
* **Customer Debt Ledgers:** Comprehensive debt statement printouts in [`customers/page.tsx`](src/app/dashboard/customers/page.tsx) that collapse UI chrome and format multi-page account ledgers cleanly.

### 3. Multi-Currency Engine & Regional Payment Rails
* **Base Currency Ledger:** Base inventory valuations and item prices are accounted in USD ($).
* **Configurable Daily Market Rates:** Each tenant configures their active market exchange rate in [`settings/page.tsx`](src/app/dashboard/settings/page.tsx) (e.g. 1 USD = 8,500 SLSH).
* **Dynamic Checkout Conversion:** POS receipts and pay screens automatically display dual currency totals:
  $$\text{Total}_{\text{SLSH}} = \text{Total}_{\text{USD}} \times \text{Exchange Rate}$$
* **Regional Payment Methods:** Native support for Horn of Africa payment systems:
  * 💸 **ZAAD Service** (Telesom Mobile Money)
  * 🐪 **eDahab** (Dahabshiil Mobile Money)
  * 📱 **EVC Plus** (Hormuud Mobile Money)
  * 💵 **Cash USD** ($)
  * 💴 **Cash SLSH** (Somaliland Shillings)
  * 📓 **Deyn / Credit** (Customer debt ledger integration)

### 4. Atomic Inventory & Deconsolidation (Auto-Breakdown)
* **Atomic RPC Checkout:** Checkouts execute through the PostgreSQL function [`process_pos_checkout`](supabase/rpc_atomic_checkout.sql), bundling sale record insertion, line item creation, stock reduction, and customer wallet updates into a single atomic transaction.
* **Pessimistic Concurrency (`FOR UPDATE`):** Product rows are locked during checkout. If two cashiers scan the last remaining unit concurrently, race conditions and overselling are strictly prevented.
* **Carton-to-Unit Auto-Breakdown:** Products support hierarchical packaging (`parent_product_id` and `breakdown_ratio`). When individual units run out (e.g., loose soda cans), the engine automatically unpacks parent bulk cartons, deducts carton inventory, increments piece inventory, and completes the transaction transparently.

---

## 🗄️ Relational Database Schema & Multi-Tenancy

The database schema ([`supabase/schema.sql`](supabase/schema.sql)) consists of **18 relational tables** with Row Level Security (RLS) enabled on every entity:

| Table | Purpose | Multi-Tenant Key |
| :--- | :--- | :--- |
| `tenants` | Master store organization record | `id` |
| `tenant_subscriptions` | SaaS subscription state (trial, active, past_due) | `tenant_id` |
| `tenant_settings` | Currency, exchange rate, tax rate, receipt headers | `tenant_id` |
| `user_roles` | Maps `auth.users` to tenant with roles (`owner`, `cashier`, etc.) | `tenant_id` |
| `shifts` | Cash drawer register shifts and reconciliation | `tenant_id` |
| `customers` | Customer profiles, wallet balances, debt tracking | `tenant_id` |
| `suppliers` | Wholesale vendor ledger and debt owed | `tenant_id` |
| `categories` | Product hierarchy and departments | `tenant_id` |
| `products` | Barcode, SKU, stock, unit price, breakdown ratio | `tenant_id` |
| `purchases` | Inbound purchase orders from suppliers | `tenant_id` |
| `purchase_items` | Line items for inbound restocks | `tenant_id` |
| `stock_movements` | Immutable audit trail for every inventory change | `tenant_id` |
| `sales` | Completed retail transactions and tender details | `tenant_id` |
| `sale_items` | Individual line items attached to a sale | `tenant_id` |
| `invoices` | Formal accounts receivable invoices | `tenant_id` |
| `payments` | Customer debt settlements and partial payments | `tenant_id` |
| `expenses` | Daily operational store expenditures | `tenant_id` |
| `audit_logs` | Security trace log for sensitive actions | `tenant_id` |

### Multi-Tenant Isolation Rule
```sql
CREATE POLICY "Tenant Data Isolation" 
ON public.products FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));
```
All tenant queries route through `public.get_user_tenant_ids()` (`SECURITY DEFINER` with explicit `search_path = public`), ensuring zero cross-tenant leakage.

---

## 🧪 Automated Testing & Concurrency Validation

The repository includes a comprehensive Playwright End-to-End stress test suite ([`e2e/pos-stress.spec.ts`](e2e/pos-stress.spec.ts)) verifying:

1. **Rapid 5 Scans:** Verifies React state stability during burst scanner inputs.
2. **Camera Fallback:** Tests graceful recovery when camera permissions are denied.
3. **Offline Lookup:** Tests local in-memory cache resilience during network drops.
4. **Oversell Concurrency:** Simulates two concurrent cashiers attempting to buy a single remaining unit; validates that PostgreSQL pessimistic locking permits only one sale while rejecting the second.
5. **Debt Checkout & Receipts:** Validates credit ledger adjustments and receipt rendering.
6. **Multi-Tenant RLS Boundary:** Confirms that Tenant A cannot access, query, or mutate Tenant B records.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: `v20.x` or `v22.x`
* **Package Manager**: `npm` (or `pnpm`)
* **Supabase Account**: Cloud or local CLI instance

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/usaamakhadar/dukaan-pro.git
cd dukaan-pro
npm install
```

### 2. Configure Environment Variables
Copy the template environment file:
```bash
cp .env.example .env.local
```
Fill in your Supabase project credentials in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Initialize the Database
Execute the SQL migrations in order within your Supabase SQL Editor:
1. `supabase/schema.sql` (Core schema, RLS policies, trigger)
2. `supabase/rpc_atomic_checkout.sql` (Atomic checkout RPC)
3. `supabase/migrations/20260530_auto_breakdown.sql` (Deconsolidation algorithm)
4. `supabase/migrations/20260731_security_fixes.sql` (Security hardening)

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Type Checks & Stress Tests
```bash
# TypeScript Typecheck (0 errors)
npx tsc --noEmit

# Execute Playwright E2E Stress Tests
npx playwright test
```

---

## 👨‍💻 Author & Engineering Profile

**Usama Khadar Hersi**  
*Full-Stack & Systems Software Engineer*  
*Specializing in High-Performance Web Applications, Retail Systems, Distributed Architectures & Cloud SaaS.*

* **GitHub:** [@usaamakhadar](https://github.com/usaamakhadar)
* **Project Repository:** [dukaan-pro](https://github.com/usaamakhadar/dukaan-pro)

---

## 📄 License
This project is proprietary and built as a flagship software engineering showcase. All rights reserved.
