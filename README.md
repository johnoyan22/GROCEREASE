# GrocerEase

GrocerEase is a capstone project with:

- a React 19 frontend built with Vite and Tailwind CSS;
- a Laravel 12 API backend;
- Laravel Sanctum cookie-based authentication; and
- a MySQL database.

The frontend and backend run as two separate development servers. XAMPP can
provide MySQL, but starting XAMPP alone does **not** start the Laravel API or
the React frontend.

## Project structure

```text
GROCEREASE/
|-- frontend/          React and Vite application
`-- backend/
    `-- laravel/       Laravel API application
```

## Requirements

Install the following before setting up the project:

- Git
- PHP 8.2 or newer in the Laravel 12 supported range
- Composer
- MySQL (XAMPP's MySQL is supported)
- Node.js and npm

Verify that the command-line tools are available:

```powershell
git --version
php --version
composer --version
node --version
npm --version
```

If `php` is not recognized on Windows but XAMPP is installed, add the XAMPP
PHP directory, commonly `C:\xampp\php`, to the Windows `Path`, then open a new
terminal. Composer must use PHP 8.2 or newer.

## First-time setup

Complete every section below on each developer's computer. Environment files,
installed dependencies, and local databases are intentionally not included in
Git.

### 1. Clone the project

This project currently uses the `backend-clean-rebuild` branch:

```powershell
git clone --branch backend-clean-rebuild --single-branch https://github.com/johnoyan22/GROCEREASE.git
cd GROCEREASE
```

If the repository is already cloned, update it without discarding local work:

```powershell
git switch backend-clean-rebuild
git pull --ff-only origin backend-clean-rebuild
```

Commit or stash any local changes before pulling if Git reports a conflict.

### 2. Start MySQL and create the database

Open the XAMPP Control Panel and start **MySQL**. Apache is optional for this
project; it is only needed if you want to open phpMyAdmin through XAMPP.

Create an empty database named `grocerease` using one of these methods.

#### Option A: phpMyAdmin

1. Start Apache and MySQL in XAMPP.
2. Open `http://localhost/phpmyadmin`.
3. Select **Databases**.
4. Enter `grocerease` as the database name.
5. Choose `utf8mb4_unicode_ci` if a collation is requested.
6. Select **Create**.

#### Option B: MySQL command line

Sign in with a MySQL account that can create databases, then run:

```sql
CREATE DATABASE grocerease
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
```

Do not manually create the application's tables. Laravel migrations will do
that in a later step.

### 3. Install the backend dependencies

From the project root:

```powershell
cd backend\laravel
composer install
```

`composer install` creates the ignored `vendor` directory using the exact
versions recorded in `composer.lock`.

### 4. Create and configure the backend environment file

While still in `backend\laravel`, create `.env` from the provided template:

```powershell
Copy-Item .env.example .env
```

On Git Bash, macOS, or Linux, use:

```bash
cp .env.example .env
```

Open `backend/laravel/.env` and replace the relevant settings with:

```dotenv
APP_NAME=GrocerEase
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=grocerease
DB_USERNAME=root
DB_PASSWORD=

SESSION_DRIVER=database
SESSION_DOMAIN=null
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173,localhost:8000,127.0.0.1:8000
```

The default XAMPP MySQL `root` account commonly has a blank password. If your
local MySQL account has a password, put it after `DB_PASSWORD=`. Do not commit
the `.env` file or share real passwords in chat or screenshots.

### 5. Generate the Laravel key and initialize the database

Run these commands from `backend\laravel`:

```powershell
php artisan key:generate
php artisan optimize:clear
php artisan migrate --seed
```

These commands:

1. create the machine-specific application encryption key;
2. clear configuration and route caches that may contain old settings;
3. create the application and session tables; and
4. load the development roles and login accounts.

To confirm the migrations completed successfully:

```powershell
php artisan migrate:status
```

Every migration should report `Ran`. If a database error appears, recheck that
MySQL is running, the `grocerease` database exists, and the credentials in
`.env` match the local MySQL installation.

### 6. Start the Laravel backend

From `backend\laravel`, run:

```powershell
php artisan serve --host=localhost --port=8000
```

Keep this terminal open. A successful startup reports that the server is
running at `http://localhost:8000`.

Verify the backend in a browser:

```text
http://localhost:8000/up
```

The page should indicate that the application is healthy. If it does not load,
the frontend will not be able to log in.

> XAMPP Apache does not replace `php artisan serve` in this setup. The frontend
> is explicitly configured to contact Laravel on port `8000`.

### 7. Install and configure the frontend

Open a **second terminal** at the project root, then run:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

On Git Bash, macOS, or Linux, replace the last command with:

```bash
cp .env.example .env
```

Confirm that `frontend/.env` contains:

```dotenv
VITE_API_URL=http://localhost:8000/api
```

Start the frontend on the expected port:

```powershell
npm run dev -- --host localhost --port 5173
```

Keep this terminal open and visit:

```text
http://localhost:5173
```

If Vite says port `5173` is already in use, stop the other process before
continuing. Allowing Vite to silently switch to `5174` will cause the default
Laravel CORS and Sanctum configuration not to match the frontend origin.

### 8. Sign in with a development account

`php artisan migrate --seed` creates the accounts below. Their development
password is `password123`.

| Role | Email |
| --- | --- |
| Admin | `admin@grocerease.com` |
| Supervisor | `supervisor@grocerease.com` |
| Inventory Worker | `inventory@grocerease.com` |
| Shopper | `shopper@grocerease.com` |

These predictable credentials are for local development only. Do not use them
for a deployed or production environment.

## Starting the project after the initial setup

The setup commands do not need to be repeated every day. For normal local
development:

1. Start MySQL in XAMPP.
2. Start Laravel in one terminal:

   ```powershell
   cd backend\laravel
   php artisan serve --host=localhost --port=8000
   ```

3. Start React in a second terminal:

   ```powershell
   cd frontend
   npm run dev -- --host localhost --port 5173
   ```

4. Open `http://localhost:5173`.

Apache is not required unless you use phpMyAdmin.

## Updating an existing local copy

After pulling new code, install any changed dependencies and apply new
migrations:

```powershell
git pull --ff-only origin backend-clean-rebuild

cd backend\laravel
composer install
php artisan optimize:clear
php artisan migrate

cd ..\..\frontend
npm install
```

Do not copy `.env.example` over an existing `.env` during routine updates; that
would overwrite local database configuration. Review `.env.example` manually
if a pull introduces new environment variables.

Run `php artisan db:seed` only when seed data needs to be added again. Some
seeders may assume that their records do not already exist.

## Troubleshooting

### "Could not start a secure session"

This project displays that message when the frontend requests:

```text
http://localhost:8000/sanctum/csrf-cookie
```

and Laravel returns a non-success status. It happens before the submitted email
and password are checked, so changing login credentials will not fix it.

Check the following in order:

1. MySQL is running in XAMPP.
2. `php artisan serve` is still running at `http://localhost:8000`.
3. `http://localhost:8000/up` loads successfully.
4. Both `backend/laravel/.env` and `frontend/.env` exist. They are ignored by
   Git and therefore do not appear automatically after cloning.
5. `APP_KEY` in the Laravel `.env` is not blank. If it is blank, run
   `php artisan key:generate`.
6. The database name and MySQL credentials are correct.
7. `php artisan migrate:status` shows that the `sessions` table migration ran.
8. The browser is using `http://localhost:5173`, not a different Vite port.
9. The frontend and backend consistently use `localhost`. Avoid opening one
   through `127.0.0.1` while the other uses `localhost`, because Sanctum relies
   on host-specific cookies.

After correcting `.env`, clear Laravel's cached configuration and restart the
backend:

```powershell
cd backend\laravel
php artisan optimize:clear
php artisan serve --host=localhost --port=8000
```

Inspect the most recent Laravel errors with:

```powershell
Get-Content storage\logs\laravel.log -Tail 100
```

Common log messages include:

| Error | Likely cause | Resolution |
| --- | --- | --- |
| `No application encryption key has been specified` | `APP_KEY` is missing | Run `php artisan key:generate` |
| `Unknown database 'grocerease'` | The local database was not created | Create the `grocerease` database |
| `Access denied for user` | MySQL username or password is incorrect | Correct the `DB_*` values in `.env` |
| `Table 'grocerease.sessions' doesn't exist` | Migrations were not applied | Run `php artisan migrate --seed` |
| `Connection refused` | MySQL is stopped or the port is wrong | Start MySQL and confirm `DB_PORT=3306` |

### "Failed to fetch" or a browser CORS error

This normally means the Laravel server is unreachable, the API URL is wrong,
or the frontend is running from an origin Laravel does not allow.

Confirm these exact addresses:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
API:      http://localhost:8000/api
```

Then confirm `frontend/.env` contains the correct `VITE_API_URL` and restart
Vite after changing it. Vite reads environment variables only at startup.

### "The security cookie was not found"

The backend responded, but the browser did not make the Sanctum CSRF cookie
available to the frontend. Use `localhost` consistently, verify that Vite is on
port `5173`, and confirm that the Sanctum and session settings shown in the
backend `.env` section are present. Clear cookies for `localhost`, restart both
servers, and try again.

### Port 8000 or 5173 is already in use

Stop the old development server using that port, then start the project again.
Do not casually change the ports: the frontend API URL, Laravel CORS origins,
and Sanctum stateful domains must all agree when a port changes.

### Changes to `.env` do not take effect

Restart the relevant development server. For Laravel, also run:

```powershell
php artisan optimize:clear
```

For the frontend, stop and restart `npm run dev`.

## Current project status

The React login and logout flows use Laravel Sanctum session cookies. Login
sends the user to the dashboard for their role, and a frontend route guard
redirects signed-out users away from role pages. This frontend guard controls
page navigation; Laravel role middleware must also protect sensitive API routes
as those modules are connected.

Registration and most business modules are still in development, and many
screens currently use local mock data. Product Management's page, table,
summary cards, and form can be reviewed while the Laravel modules are built.

## Frontend data contract for backend development

The Product Management mock follows the approved screen: product name and size,
SKU and barcode, category, one displayed price, stock quantity, availability,
status, and last updated. The mock stores the price as `selling_price`, the
displayed stock as `hard_stock_qty`, and keeps `soft_stock_qty` for reserved
inventory calculations. A row also carries `product_id` and
`store_inventory_id`; it is a frontend view combining product details with a
store's inventory values, not one database table.

The supplied data dictionary separates `PRODUCTS` from `STORE_INVENTORY`,
places `base_cost` on `PRODUCTS`, and places `selling_price`, `hard_stock_qty`,
and `soft_stock_qty` on `STORE_INVENTORY`. The screen's displayed price uses
the store selling price; it does not display `base_cost`. The dictionary does
not list `sku`, `barcode`, `size`, or `status`, so reconcile those fields with
the team before designing the Product migration.

The authenticated roles are Shopper, Inventory Worker, Supervisor, and Admin.
Picker/packer Worker records are operational roster data for order fulfillment
and are not user accounts, RBAC roles, or a worker-facing portal. The supplied
dictionary's `WORKER.profile_id` relationship conflicts with this role decision
and should be reviewed before designing worker tables or authentication.
