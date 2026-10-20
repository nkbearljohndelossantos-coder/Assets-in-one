# Data Dictionary
## Unified ITMS + PPE Enterprise System

---

## 1. Overview

This document provides a comprehensive field-level data dictionary for the Unified ITMS + PPE database. Each field includes physical types, nullability, validation constraints, business descriptions, and its provenance from the legacy systems.

---

## 2. Shared Platform Tables

### Table: `users`
| Field | Type | Nullable | Default | Provenance | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INTEGER | NO | Auto-Increment | Unified Core | Unique surrogate identifier for the user account. |
| `username` | VARCHAR(100) | NO | - | Merged | Unique username used for system login. |
| `email` | VARCHAR(150) | NO | - | Merged | Unique corporate email address. |
| `password` | VARCHAR(255) | NO | - | Unified Core | Salted bcrypt hash ($2a$10$) of user password. |
| `full_name` | VARCHAR(150) | YES | NULL | ITMS (`fullName`) / PPE (`full_name`) | User's legal first and last name. |
| `department` | VARCHAR(100) | YES | NULL | Merged | Primary organizational division (e.g., IT, Accounting, Operations). |
| `position` | VARCHAR(100) | YES | NULL | ITMS | Job title or designation. |
| `phone` | VARCHAR(50) | YES | NULL | ITMS | Contact telephone or extension number. |
| `status` | VARCHAR(20) | NO | `'ACTIVE'` | Merged | Account status (`ACTIVE`, `INACTIVE`, `SUSPENDED`). |
| `force_password_change` | BOOLEAN | NO | `0` | ITMS | If 1, user must set new password on subsequent authentication. |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Merged | Timestamp when user record was created. |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP | Merged | Timestamp when user record was last modified. |

### Table: `audit_logs`
| Field | Type | Nullable | Default | Provenance | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INTEGER | NO | Auto-Increment | Unified Core | Unique identifier for the audit event. |
| `user_id` | INTEGER | YES | NULL | Unified Core | Foreign key to `users.id` representing actor. |
| `username` | VARCHAR(100) | YES | NULL | Unified Core | Snapshot of actor's username at log time. |
| `action` | VARCHAR(100) | NO | - | Unified Core | Business action performed (e.g., `Create Asset`, `Post Journal`). |
| `module` | VARCHAR(50) | NO | - | Unified Core | Functional domain (e.g., `PPE`, `Assets`, `Tickets`, `Auth`). |
| `record_id` | VARCHAR(100) | YES | NULL | Unified Core | Target primary key / reference identifier. |
| `ip_address` | VARCHAR(45) | YES | NULL | Unified Core | Client IPv4 or IPv6 address. |
| `user_agent` | TEXT | YES | NULL | Unified Core | HTTP User-Agent string from request. |
| `old_values` | JSON / TEXT | YES | NULL | Unified Core | Previous state representation before modification. |
| `new_values` | JSON / TEXT | YES | NULL | Unified Core | New state representation after modification. |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Unified Core | Tamper-evident timestamp of event execution. |

---

## 3. PPE (Property, Plant, and Equipment) Tables

### Table: `ppe_assets`
| Field | Type | Nullable | Default | Provenance | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INTEGER | NO | Auto-Increment | PPE | Surrogate primary key. |
| `asset_code` | VARCHAR(50) | NO | - | PPE | Standard sequential code formatted as `PPE-YYYY-0001`. |
| `category_id` | INTEGER | NO | - | PPE | Foreign key to `ppe_asset_categories.id`. |
| `name` | VARCHAR(150) | NO | - | PPE | Descriptive name of capital asset. |
| `description` | TEXT | YES | NULL | PPE | Operational and technical specifications. |
| `model` | VARCHAR(100) | YES | NULL | PPE | Manufacturer model designation. |
| `serial_number` | VARCHAR(100) | YES | NULL | PPE | Manufacturer hardware serial number. |
| `status` | VARCHAR(50) | NO | `'ACTIVE'` | PPE | Asset state (`ACTIVE`, `UNDER_MAINTENANCE`, `DISPOSED`, `FULLY_DEPRECIATED`). |
| `location` | VARCHAR(150) | YES | NULL | PPE | Physical plant, building, or room location. |
| `department` | VARCHAR(100) | YES | NULL | PPE | Custodial organizational unit. |
| `custodian_id` | INTEGER | YES | NULL | PPE | Foreign key to `users.id` denoting custodian employee. |
| `custodian_name` | VARCHAR(150) | YES | NULL | PPE | Denormalized display name of custodian. |
| `purchase_date` | DATE | NO | - | PPE | In-service or capitalization date. |
| `acquisition_cost` | DECIMAL(14,2)| NO | - | PPE | Gross purchase / historical acquisition cost in PHP (₱). |
| `salvage_value` | DECIMAL(14,2)| NO | `0.00` | PPE | Estimated residual value; depreciation stops at this floor. |
| `useful_life_years`| DECIMAL(4,1) | NO | - | PPE | Asset life expectancy in years. |
| `accumulated_depreciation`| DECIMAL(14,2)| NO | `0.00` | PPE | Cumulative recognized depreciation expense to date. |
| `net_book_value` | DECIMAL(14,2)| NO | - | PPE | Current financial carrying value (`acquisition_cost - accumulated_depreciation`). |
| `photo_url` | VARCHAR(255) | YES | NULL | PPE | Relative path to asset photograph. |
| `qr_code` | TEXT | YES | NULL | PPE | Fast-response QR code payload or data URI. |
| `notes` | TEXT | YES | NULL | PPE | Accounting, maintenance, or audit notes. |

### Table: `ppe_gl_accounts`
| Field | Type | Nullable | Default | Provenance | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INTEGER | NO | Auto-Increment | PPE | Primary key. |
| `code` | VARCHAR(20) | NO | - | PPE | General Ledger chart code (e.g., `1500`, `1510`, `5200`). |
| `name` | VARCHAR(100) | NO | - | PPE | Account title (e.g., `Machinery & Equipment`, `Depreciation Expense`). |
| `type` | VARCHAR(20) | NO | - | PPE | Accounting category (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`). |
| `description` | TEXT | YES | NULL | PPE | Guidance on posting criteria for this account. |
| `balance` | DECIMAL(14,2)| NO | `0.00` | PPE | Current running ledger balance. |

### Table: `ppe_journal_entries`
| Field | Type | Nullable | Default | Provenance | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INTEGER | NO | Auto-Increment | PPE | Primary key. |
| `entry_number` | VARCHAR(50) | NO | - | PPE | Sequential Journal Voucher identifier (`JV-YYYYMM-0001`). |
| `entry_date` | DATE | NO | - | PPE | Accounting effective date. |
| `reference` | VARCHAR(100) | YES | NULL | PPE | Source document or batch reference. |
| `description` | TEXT | NO | - | PPE | Transaction memo detailing entry rationale. |
| `total_debit` | DECIMAL(14,2)| NO | - | PPE | Sum of all debits; must equal `total_credit`. |
| `total_credit`| DECIMAL(14,2)| NO | - | PPE | Sum of all credits; must equal `total_debit`. |
| `status` | VARCHAR(20) | NO | `'POSTED'` | PPE | Ledger posting status (`POSTED`, `VOID`). |
| `created_by` | INTEGER | YES | NULL | PPE | Foreign key to `users.id` who recorded the JV. |

### Table: `ppe_journal_lines`
| Field | Type | Nullable | Default | Provenance | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INTEGER | NO | Auto-Increment | PPE | Primary key. |
| `journal_id` | INTEGER | NO | - | PPE | Foreign key to `ppe_journal_entries.id`. |
| `account_id` | INTEGER | NO | - | PPE | Foreign key to `ppe_gl_accounts.id`. |
| `debit` | DECIMAL(14,2)| NO | `0.00` | PPE | Debit monetary amount. |
| `credit` | DECIMAL(14,2)| NO | `0.00` | PPE | Credit monetary amount. |
| `description` | VARCHAR(255) | YES | NULL | PPE | Line-item specific posting narration. |

### Table: `ppe_returnable_containers`
| Field | Type | Nullable | Default | Provenance | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INTEGER | NO | Auto-Increment | PPE | Primary key. |
| `container_code`| VARCHAR(50) | NO | - | PPE | Barcode / visual ID of pallet, tote, or cylinder. |
| `type` | VARCHAR(50) | NO | - | PPE | Packaging specification (`PLASTIC_PALLET`, `STEEL_CRATE`, etc.). |
| `status` | VARCHAR(50) | NO | `'AVAILABLE'`| PPE | Operational status (`AVAILABLE`, `ASSIGNED`, `IN_TRANSIT`, `DAMAGED`). |
| `current_location`| VARCHAR(150)| YES | NULL | PPE | Present physical warehouse, bay, or customer site. |
| `assigned_party`| VARCHAR(150) | YES | NULL | PPE | Customer, carrier, or internal vendor holding container. |

---

## 4. ITMS Domain Tables

### Table: `assets`
| Field | Type | Nullable | Default | Provenance | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INTEGER | NO | Auto-Increment | ITMS | Primary key. |
| `asset_tag` | VARCHAR(50) | NO | - | ITMS | IT tracking barcode / tag (e.g., `LAP-2024-001`). |
| `name` | VARCHAR(100) | NO | - | ITMS | Hardware host or workstation name. |
| `category` | VARCHAR(50) | NO | - | ITMS | Hardware class (`Laptop`, `Desktop`, `Server`, `Printer`, `Radio`). |
| `brand` | VARCHAR(50) | YES | NULL | ITMS | OEM manufacturer (e.g., Dell, Lenovo, HP). |
| `model` | VARCHAR(50) | YES | NULL | ITMS | OEM model designation. |
| `serial_number`| VARCHAR(100) | YES | NULL | ITMS | OEM serial number. |
| `status` | VARCHAR(30) | NO | `'Available'`| ITMS | Lifecycle state (`Available`, `Deployed`, `Under Repair`, `Retired`). |
| `assigned_to` | INTEGER | YES | NULL | ITMS | Foreign key to `users.id` representing assigned user. |
| `department` | VARCHAR(50) | YES | NULL | ITMS | Department using equipment. |
| `location` | VARCHAR(100) | YES | NULL | ITMS | Building floor, desk, or server rack. |
| `purchase_date`| DATE | YES | NULL | ITMS | Procurement date. |
| `warranty_expiry`| DATE | YES | NULL | ITMS | OEM hardware warranty expiration date. |

### Table: `tickets`
| Field | Type | Nullable | Default | Provenance | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INTEGER | NO | Auto-Increment | ITMS | Primary key. |
| `ticket_number`| VARCHAR(50) | NO | - | ITMS | Unique human-readable ticket number (e.g., `TICK-1001`). |
| `title` | VARCHAR(150) | NO | - | ITMS | Short subject line describing the request or incident. |
| `description` | TEXT | NO | - | ITMS | Detailed issue description and troubleshooting notes. |
| `priority` | VARCHAR(20) | NO | `'Medium'` | ITMS | Urgency rank (`Low`, `Medium`, `High`, `Critical`). |
| `status` | VARCHAR(30) | NO | `'Open'` | ITMS | Workflow state (`Open`, `In Progress`, `Pending Parts`, `Resolved`, `Closed`). |
| `category` | VARCHAR(50) | YES | NULL | ITMS | Issue classification (`Hardware`, `Software`, `Network`, `Access`). |
| `requested_by` | INTEGER | YES | NULL | ITMS | Foreign key to `users.id` representing issue reporter. |
| `assigned_to` | INTEGER | YES | NULL | ITMS | Foreign key to `users.id` representing IT technician assigned. |
