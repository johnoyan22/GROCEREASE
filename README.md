# GrocerEase

GrocerEase is a React frontend prototype built with Vite, React Router, and Tailwind CSS.

## Clone or update this branch

This project branch is `backend-clean-rebuild`.

To clone it for the first time:

```bash
git clone --branch backend-clean-rebuild --single-branch https://github.com/johnoyan22/GROCEREASE.git
cd GROCEREASE
```

To update an existing clone, first commit or stash any local changes you want to keep, then run:

```bash
git switch backend-clean-rebuild
git pull --ff-only origin backend-clean-rebuild
```

Pulling the branch updates the source code. Each developer still needs to install the frontend and backend dependencies and create their own local environment files.

## Requirements

- Git
- PHP 8.2 or newer in the Laravel 12 supported range, with Composer
- MySQL and a MySQL client such as phpMyAdmin
- Node.js and npm

## Set up and run the backend

Open a terminal at the project root, then:

```bash
cd backend/laravel
composer install
```

Create a local environment file. In PowerShell, run:

```powershell
Copy-Item .env.example .env
```

In Git Bash, macOS, or Linux, use `cp .env.example .env` instead. Open `backend/laravel/.env` and configure it for your local MySQL installation. For this project, the database is named `grocerease`:

```dotenv
APP_URL=http://localhost:8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=grocerease
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
SESSION_DRIVER=database
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173,localhost:8000,127.0.0.1:8000
```

Create an empty MySQL database called `grocerease` using phpMyAdmin or your MySQL client. Replace `your_mysql_password` with the password for your local MySQL user; leave it empty if that user has no password.

Then generate the Laravel application key, create the tables, and load the role and development accounts:

```bash
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Keep this terminal running. Laravel serves the API at `http://localhost:8000`. Use `localhost` consistently for both the frontend and backend during local development so the session cookies work correctly.

## Set up and run the frontend

Open a second terminal at the project root:

```bash
cd frontend
npm install
```

Create `frontend/.env` from the example. In PowerShell:

```powershell
Copy-Item .env.example .env
```

In Git Bash, macOS, or Linux, use `cp .env.example .env`. The example points the React app at the local Laravel API:

```dotenv
VITE_API_URL=http://localhost:8000/api
```

Start Vite:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. Keep the backend and frontend terminals running while using the app.

### Development login accounts

`php artisan migrate --seed` creates these local test accounts. They all use the password `password123`:

| Role | Email |
| --- | --- |
| Admin | `admin@grocerease.com` |
| Supervisor | `supervisor@grocerease.com` |
| Inventory Worker | `inventory@grocerease.com` |
| Shopper | `shopper@grocerease.com` |

These predictable credentials are for local development only. Do not use them for a deployed or production environment.

## Current project status

The React login and logout flows use Laravel Sanctum session cookies. Login sends the user to the dashboard for their role, and a frontend route guard redirects signed-out users away from role pages. This frontend guard controls page navigation; Laravel role middleware must also protect sensitive API routes as those modules are connected. Registration and business modules are still in development, and most screens use mock data.

Most business screens still use local mock data. Product Management's page, table, summary cards, and form can be reviewed while the Laravel modules are built.

## Frontend data contract for the backend lessons

The Product Management mock follows the approved screen: product name and size, SKU and barcode, category, one displayed price, stock quantity, availability, status, and last updated. The mock stores the price as `selling_price`, the displayed stock as `hard_stock_qty`, and keeps `soft_stock_qty` for reserved inventory calculations. A row also carries `product_id` and `store_inventory_id`; it is a frontend view combining product details with a store's inventory values, not one database table.

The supplied data dictionary separates `PRODUCTS` from `STORE_INVENTORY`, places `base_cost` on `PRODUCTS`, and places `selling_price`, `hard_stock_qty`, and `soft_stock_qty` on `STORE_INVENTORY`. The screen's displayed price uses the store selling price; it does not display `base_cost`. The dictionary does not list `sku`, `barcode`, `size`, or `status`, so reconcile those fields with the team before designing the Product migration.

The authenticated roles are Shopper, Inventory Worker, Supervisor, and Admin. Picker/packer Worker records are operational roster data for order fulfillment and are not user accounts, RBAC roles, or a worker-facing portal. The supplied dictionary's `WORKER.profile_id` relationship conflicts with this role decision and should be reviewed before designing worker tables or authentication.
