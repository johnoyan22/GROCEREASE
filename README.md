# GrocerEase

GrocerEase is a React frontend prototype built with Vite, React Router, and Tailwind CSS.

## Run the frontend

Requirements: Node.js and npm.

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Current project status

This branch is preparing the frontend for a fresh backend rebuild. No backend is included yet. Login, registration, and logout are UI-only prototypes; they do not authenticate users or create accounts. Role routes are intentionally available directly for development previews.

Most screens use local mock data. Product Management also uses local data so its page, table, summary cards, and form can be reviewed without a server. The future Laravel and MySQL setup will be documented as it is built and taught.

## Frontend data contract for the backend lessons

The Product Management mock uses the agreed UI fields: `product_name`, `sku`, `barcode`, `size`, `category`, `base_price`, `selling_price`, `hard_stock_qty`, `soft_stock_qty`, `status`, and `updated_at`. Its rows also carry `product_id` and `store_inventory_id` identifiers. A row is a frontend view that combines product details with a store's inventory values; it does not define one database table.

The supplied data dictionary separates `PRODUCTS` from `STORE_INVENTORY`, places `base_cost` on `PRODUCTS`, and places `selling_price`, `hard_stock_qty`, and `soft_stock_qty` on `STORE_INVENTORY`. The UI contract uses `base_price` and includes `sku`, `barcode`, `size`, and `status`, which are not in those dictionary tables. Reconcile these naming and schema differences with the team before designing the Product migration; `base_cost` and `base_price` are not assumed to mean the same thing.

The authenticated roles are Shopper, Inventory Worker, Supervisor, and Admin. Picker/packer Worker records are operational roster data for order fulfillment and are not user accounts, RBAC roles, or a worker-facing portal. The supplied dictionary's `WORKER.profile_id` relationship conflicts with this role decision and should be reviewed before designing worker tables or authentication.
