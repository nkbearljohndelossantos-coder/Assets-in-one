# Unified ITMS + PPE Enterprise Application

[![Production Status](https://img.shields.io/badge/Status-Production%20Ready-emerald.svg)](#)
[![Test Suite](https://img.shields.io/badge/Tests-9%20Passed%20%7C%200%20Failed-brightgreen.svg)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Modular%20Monolith-blue.svg)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20Tailwind-61dafb.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green.svg)](#)
[![Database](https://img.shields.io/badge/Database-SQLite3%20%2F%20MySQL%20(Knex)-orange.svg)](#)

---

## 1. Executive Overview

The **Unified ITMS + PPE Enterprise System** is a consolidated, production-grade web application integrating two previously independent business domains:
1. **ITMS (IT Management System)**: IT hardware inventory, lifecycle tracking, employee custody, preventive maintenance, repair work orders, software licenses, spare parts consumables, and an IT help desk ticketing service.
2. **PPE (Property, Plant, and Equipment)**: Capital asset registry, straight-line depreciation engine with residual value floors, Chart of Accounts, balanced double-entry Journal Vouchers (JVs), returnable container logistics (pallets, totes, crates), and fixed asset compliance reporting (Excel & PDF).

This is **NOT** a dashboard portal or iframe wrapper. The application features a unified React 18 frontend, a unified Express.js backend, a single relational database with 144 domain tables, a unified JWT/Bcrypt authentication system, and 77 granular permissions across 7 normalized roles.

---

## 2. Key Capabilities & Integrated Features

### 🏢 Capital Property, Plant & Equipment (PPE)
- **Asset Registry**: Sequential automated asset code generation (`PPE-YYYY-0001`), photo capture via camera/upload, and instant QR code label generation.
- **Depreciation Engine**: Fully automated straight-line depreciation calculations with daily/monthly proration, residual salvage value floor clamps, and zero negative book values.
- **Double-Entry General Ledger**: Chart of Accounts, manual balanced Journal Vouchers ($\sum \text{Dr} = \sum \text{Cr}$), and one-click monthly automated depreciation journal posting.
- **Returnable Containers**: Reusable container fleet tracking (pallets, crates, IBC totes) with check-in, check-out, transfer, and damage audit logging.
- **Reporting & Compliance**: Fixed Asset Register exports in Excel (`.xlsx`) and printable PDF formats with customizable as-of capitalization dates.

### 💻 IT Infrastructure & Help Desk (ITMS)
- **IT Hardware Inventory**: Workstations, laptops, monitors, two-way radios, and network hardware.
- **Service Desk**: Multi-tier incident ticketing, assignments, priority SLA tracking, and discussion history.
- **Repairs & Maintenance**: Preventive maintenance scheduling, repair orders, technician logs, and spare parts inventory usage.
- **IT Operations Hub**: Remote device management, web & application filtering MDM, database backups, endpoint security, and network IP scanning.

### 🛡️ Core Platform & Security
- **Unified Authentication**: Single sign-on supporting either `username` or corporate `email` with bcrypt-salted password hashing.
- **Granular RBAC**: 77 distinct permissions mapped to 7 normalized roles (`SUPER_ADMIN`, `ADMIN`, `STAFF`, `ACCOUNTANT`, `USER`).
- **Immutable Audit Logging**: Automatic recording of user, IP, module, and state diffs for all financial and administrative modifications.
- **OpenAPI 3.0 Documentation**: Interactive Swagger UI embedded at `/docs`.

---

## 3. Directory Layout

```
unified-itms-ppe/
├── backend/                  # Unified Express.js backend
│   ├── data/                 # Relational database persistence directory
│   ├── migrations/           # 23 ordered Knex schema migrations
│   ├── seeds/                # Initial system seeds (roles, permissions, accounts)
│   ├── src/
│   │   ├── config/           # Database, logging, and Swagger OpenAPI configs
│   │   ├── middleware/       # JWT auth, RBAC, error handling, rate limiting
│   │   ├── routes/           # ITMS domain routes and shared auth routes
│   │   │   └── ppe/          # PPE domain routes (Assets, Accounting, Containers, Reports)
│   │   ├── utils/            # Depreciation engine, asset code generator, audit logger
│   │   └── server.js         # Unified server entrypoint & SPA static asset server
│   ├── uploads/              # Uploaded asset photos and documentation
│   └── package.json          # Backend npm dependencies
├── frontend/                 # Unified React 18 Single Page Application (SPA)
│   ├── src/
│   │   ├── components/       # Unified Layout, Navigation Sidebar, Toasts, Modals
│   │   ├── context/          # AuthContext (JWT, user state, permissions)
│   │   ├── pages/            # ITMS domain pages and Admin console
│   │   ├── ppe/              # PPE domain pages (Dashboard, Assets, Accounting, Containers)
│   │   └── services/         # Axios API client with automatic token refresh
│   └── package.json          # Frontend npm dependencies
├── scripts/                  # Automated verification and migration tooling
│   ├── run-migrations.js     # Ordered Knex migration runner
│   ├── migrate-data.js       # Idempotent legacy data importer & reconciliation
│   ├── test-unified-suite.js # Comprehensive 9-test unit and integration test suite
│   └── test-server-health.js # Health probe and SPA verification test
├── docs/                     # Complete system documentation (10 deliverables)
│   ├── ARCHITECTURE.md       # Technical architecture, patterns, and diagrams
│   ├── DATABASE_SCHEMA.md    # Relational ER diagram and detailed table specifications
│   ├── DATA_DICTIONARY.md    # Field-level data dictionary and provenance
│   ├── DATA_MIGRATION.md     # Migration pipeline, reconciliation, and rollback guide
│   ├── SECURITY.md           # Threat model, RBAC, input validation, defense in depth
│   ├── DEPLOYMENT.md         # Production deployment (Direct Node & Docker Compose)
│   ├── BACKUP_RESTORE.md     # Online backup scripts, retention, and disaster recovery
│   ├── TEST_REPORT.md        # Quality assurance test results (100% pass rate)
│   ├── IMPLEMENTATION_STATUS.md # Master Prompt requirement traceability matrix
│   └── DATA_MIGRATION_REPORT.json # Audited migration reconciliation report
├── Dockerfile                # Multi-stage production Dockerfile
├── docker-compose.yml        # Orchestration with named persistent volumes
├── package.json              # Root project scripts
└── .env.example              # Template environment configuration
```

---

## 4. Quick Start Guide

### Prerequisites
- Node.js >= 18.0.0 (Tested on Node.js v20.x and v26.5.1)
- npm >= 9.0.0

### Direct Node Setup (Local Development)

```bash
# 1. Clone repository and navigate to unified project root
cd unified-itms-ppe

# 2. Configure environment variables
cp .env.example .env

# 3. Install backend dependencies and run database migrations
cd backend
npm install
npm run migrate

# 4. Install frontend dependencies and build bundle
cd ../frontend
npm install
npm run build

# 5. Start unified server from project root
cd ..
npm start
```
*The unified application will be accessible at `http://localhost:5000` (or frontend dev server at `http://localhost:5173`).*

---

## 5. Docker Containerized Setup

```bash
cd unified-itms-ppe

# Launch container with persistent database and upload volumes
docker compose up -d --build

# Inspect running container
docker ps
```
*Access the web console at `http://localhost:5000` and API docs at `http://localhost:5000/docs`.*

---

## 6. Available Scripts

| Command | Action |
| :--- | :--- |
| `npm start` | Starts the unified Express production backend (serving the compiled React SPA). |
| `npm run dev:backend` | Launches backend in development mode with nodemon hot-reload. |
| `npm run dev:frontend` | Launches Vite frontend development server at `http://localhost:5173`. |
| `npm run build` | Compiles the production React bundle into `frontend/dist`. |
| `npm test` | Runs the automated 9-point verification suite (`scripts/test-unified-suite.js`). |
| `npm run health` | Executes the HTTP health check probe (`scripts/test-server-health.js`). |
| `npm run migrate` | Executes all pending database schema migrations. |
| `npm run migrate:data` | Runs the idempotent legacy data importer with reconciliation reporting. |

---

## 7. Verification & Test Execution

Run the built-in test suite at any time:

```bash
node scripts/test-unified-suite.js
```

Expected output:
```
================================================================
  NKB UNIFIED ITMS + PPE SYSTEM AUTOMATED VERIFICATION SUITE   
================================================================

  [PASS] Consolidated Database contains core ITMS and PPE tables
  [PASS] Admin account exists and password validates with bcrypt
  [PASS] JWT Token generation and verification works with required claims
  [PASS] Sequential PPE asset code generation (PPE-YYYY-0001) works atomically
  [PASS] Straight-line depreciation calculates accurate monthly and accumulated depreciation
  [PASS] Depreciation Net Book Value never falls below salvage value (residual value floor)
  [PASS] Double-entry journal integrity: balanced entries succeed, unbalanced fail
  [PASS] Returnable containers lifecycle tracking and movement logging
  [PASS] ITMS domain: IT asset registration, status, and tickets count query

Test Results: 9 passed, 0 failed
```

---

## 8. Documentation Index

For in-depth operational and architectural specifications, consult the documents in `docs/`:
- [Architecture & Modular Monolith Guide](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/ARCHITECTURE.md)
- [Database Schema & ER Diagrams](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/DATABASE_SCHEMA.md)
- [Data Dictionary & Field Reference](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/DATA_DICTIONARY.md)
- [Data Migration & Reconciliation Guide](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/DATA_MIGRATION.md)
- [Security, RBAC & Defense in Depth](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/SECURITY.md)
- [Production Deployment Guide](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/DEPLOYMENT.md)
- [Backup, Restore & Disaster Recovery](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/BACKUP_RESTORE.md)
- [Quality Assurance & Test Report](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/TEST_REPORT.md)
- [Implementation Status & Requirement Matrix](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/IMPLEMENTATION_STATUS.md)
- [Data Migration Reconciliation Report (JSON)](file:///e:/Program%20files/ONe/unified-itms-ppe/docs/DATA_MIGRATION_REPORT.json)
