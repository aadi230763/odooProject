# AssetFlow — Enterprise Asset & Resource Management System

A centralized ERP platform for tracking, allocating, and maintaining physical
assets and shared resources. Built for the **Odoo Hiring Hackathon**.

AssetFlow replaces spreadsheets and paper logs with structured asset
lifecycles, centralized resource booking, and real-time visibility into *who
holds what, where it is, and what condition it's in*. It deliberately excludes
purchasing, invoicing, and accounting.

## Tech Stack

| Layer | Choice |
|---|---|
| Database | PostgreSQL (integrity enforced at the DB level) |
| Backend | Python · Flask · SQLAlchemy · Alembic |
| Frontend | React · TypeScript · Vite |
| Auth | In-house (bcrypt hashing + RBAC) |
| Extras | Self-generated QR codes |

## Repository Structure

```
assetflow/
├── backend/     # Flask API (app factory, layered: routes → controllers → services → models)
├── frontend/    # React + TypeScript + Vite SPA
├── docs/        # ERD, API docs, ownership map
└── README.md
```

## Getting Started (from a fresh clone)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ (with the `btree_gist` extension available)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then edit values
flask --app wsgi run --debug       # serves http://localhost:5000
```

Health check: `GET http://localhost:5000/api/health`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                        # serves http://localhost:5173
```

The dev server proxies `/api/*` to the backend, so the home screen shows a
live "Backend: connected ✓" indicator when both are running.

## Development Workflow

Branching, commit conventions, and PR rules are documented in
[CONTRIBUTING.md](CONTRIBUTING.md). Module ownership is in
[docs/OWNERSHIP.md](docs/OWNERSHIP.md).

## Project Roadmap

The full phase-by-phase plan lives in [Implementation.md](Implementation.md).
