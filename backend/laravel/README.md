# GrocerEase: backend and frontend setup

Use this guide to set up a local copy of GrocerEase on **Windows with PowerShell and XAMPP**. Run the commands one block at a time; if a command fails, resolve the error before continuing. Installation paths may differ on your computer.

## 1. Understand the project

```text
GROCEREASE/
├── backend/laravel/     Laravel API, migrations, and PHP dependencies
│   ├── .env.example    Shared configuration template
│   ├── .env            Your private local settings (created during setup)
│   └── artisan         Laravel's command-line tool
└── frontend/           React application, served by Vite
    └── package.json    Frontend dependencies and npm commands
```

| Tool or command | What it does |
| --- | --- |
| MySQL in XAMPP | Starts the database server (XAMPP supplies MariaDB) |
| `CREATE DATABASE` | Creates the empty container for your tables, once |
| `composer install` | Installs PHP packages into `backend/laravel/vendor` |
| `php artisan migrate` | Applies pending database migrations to create or update tables |
| `php artisan serve` | Starts the Laravel web server; it does not run migrations |
| `npm ci` | Installs the exact frontend packages recorded in `package-lock.json` |
| `npm run dev` | Starts the React/Vite development server |

The database, Laravel server, and React server are separate processes. Starting one does not start the others.

## 2. Install the required tools

| Tool | Version/setup |
| --- | --- |
| [Git](https://git-scm.com/downloads) | Required to clone and pull the repository |
| [XAMPP](https://www.apachefriends.org/download.html) | Choose a Windows package with PHP 8.2 or newer; includes MariaDB |
| [Composer](https://getcomposer.org/doc/00-intro.md#installation-windows) | Composer 2; select XAMPP's `php.exe` during installation |
| [Node.js](https://nodejs.org/en/download) | Use Node.js 24 LTS, which includes npm and satisfies the frontend tooling requirements |

For the usual XAMPP installation, PHP is at `C:\xampp\php\php.exe`.

### Make PHP available in your terminal

1. Search Windows for **Edit environment variables for your account**.
2. Under **User variables**, select **Path**, click **Edit**, then **New**.
3. Add `C:\xampp\php` (or your actual PHP folder). Keep the existing entries.
4. Save, fully close all VS Code windows and terminals, then reopen VS Code from the Start menu. Composer's Windows installer normally adds Composer to PATH itself.

In a new PowerShell terminal, verify:

```powershell
git --version
php --version
composer --version
node --version
npm.cmd --version
```

All commands should print versions. This guide uses `npm.cmd` on Windows to avoid PowerShell blocking the `npm.ps1` launcher; it runs the same npm commands.

### Check PHP extensions

```powershell
php --ini
php -m
```

Open the **Loaded Configuration File** reported by `php --ini`. In XAMPP it is normally `C:\xampp\php\php.ini`. Enable the following existing extension lines by removing their leading `;` where necessary:

```ini
extension=curl
extension=fileinfo
extension=mbstring
extension=pdo_mysql
extension=pdo_sqlite
extension=zip
```

Do not add duplicate extension entries. `pdo_mysql` is for the application database, `pdo_sqlite` is for the automated tests, and ZIP enables Composer to extract downloaded packages. Keep the other default PHP extensions enabled. Use `php -m` again to confirm the changes.

## 3. Clone and open the repository

From the folder where you keep your projects:

```powershell
git clone https://github.com/johnoyan22/GROCEREASE.git
cd GROCEREASE
```

Open this `GROCEREASE` folder in VS Code. If you already cloned it, open your existing copy instead. In the instructions below, **repository root** means this folder containing both `backend` and `frontend`.

## 4. Set up the backend once

### Install dependencies and create your local settings

Starting from the repository root:

```powershell
cd backend/laravel
composer install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

`composer install` uses `composer.lock`; do not run `composer update` just to set up the project. The copy command preserves an existing `.env`.

Open `backend/laravel/.env` and check these settings:

```dotenv
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=grocerease_db
DB_USERNAME=root
DB_PASSWORD=
```

An empty root password applies only to a default local XAMPP installation. Use your actual username, password, and port if they differ. Keep the generated `APP_KEY` private. Change `.env` for your own computer; `.env.example` is the shared template for teammates.

### Start MySQL and create the database

Open **XAMPP Control Panel** and click **Start** beside **MySQL**. Wait for it to show as running.

Choose **one** database creation method:

**Option A: PowerShell** (default XAMPP path, port, and root account without a password):

```powershell
& "C:\xampp\mysql\bin\mysql.exe" --host=127.0.0.1 --port=3306 --user=root --execute="CREATE DATABASE grocerease_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

If your account has a password, add `--password` to the command to receive a prompt. Do not put your password directly in the command. If the database already exists, keep it and skip creation.

**Option B: phpMyAdmin:** Start **Apache** as well as MySQL in XAMPP, open `http://localhost/phpmyadmin`, choose **Databases**, enter `grocerease_db`, select `utf8mb4_unicode_ci`, and click **Create**. Apache is needed for this phpMyAdmin interface; Laravel itself runs through `artisan serve`.

### Generate the application key and create the tables

In the terminal that is still inside `backend/laravel`, run this **only if `APP_KEY` in your `.env` is empty**:

```powershell
php artisan key:generate
```

Then run:

```powershell
php artisan config:clear
php artisan migrate
php artisan migrate:status
composer check-platform-reqs
```

Every migration should show **Ran**, and the platform requirements should pass. Laravel records completed migrations, so a later `php artisan migrate` applies only new ones. Laravel can offer to create a missing database during an interactive migration if your account has permission; the explicit creation step above avoids relying on that prompt.

Do not regenerate an existing application's key during routine startup. Do not use `migrate:fresh` to fix setup errors on a database containing data you need: it drops tables. Editing an already-applied migration does not rerun it; changes to a shared database need a new corrective migration.

## 5. Set up the frontend once

Open a **second terminal at the repository root**:

```powershell
cd frontend
npm.cmd ci
```

Run this in `frontend`, not `backend/laravel`. `npm ci` recreates `node_modules` from the committed lockfile without updating dependency versions. If it reports that `package.json` and `package-lock.json` disagree, check your local changes or ask the teammate who changed dependencies; do not delete the lockfile.

There is currently no required frontend `.env` or implemented API base-URL setting. The UI and Laravel API are separate scaffolds; starting both servers does not automatically connect the screens to the database. Login and shopper-account integration remain unfinished.

## 6. Run both apps each day

Start **MySQL** in XAMPP. Open two terminals, each initially at the repository root.

**Terminal 1 — backend:**

```powershell
cd backend/laravel
php artisan serve --host=127.0.0.1 --port=8000
```

**Terminal 2 — frontend:**

```powershell
cd frontend
npm.cmd run dev -- --port 5173 --strictPort
```

Keep both terminals open. Stop each server with **Ctrl+C**. You do not need to reinstall dependencies or recreate the database on every startup.

| Address | Expected result |
| --- | --- |
| `http://localhost:5173` | GrocerEase React interface |
| `http://127.0.0.1:8000/up` | Laravel health page with HTTP 200 |
| `http://127.0.0.1:8000` | Laravel welcome page, not the React app |

Use `http://localhost:5173` for the frontend. The backend's `config/cors.php` currently permits that exact origin; `127.0.0.1:5173` and port `5174` are different origins. `--strictPort` reports a busy port instead of silently moving Vite to another one.

The health endpoint confirms Laravel boots; `migrate:status` also checks the database connection. `/api/user` requires authentication and is not a public health endpoint. To see its expected unauthenticated response:

```powershell
curl.exe -i -H "Accept: application/json" http://127.0.0.1:8000/api/user
```

With no authentication, HTTP **401** is expected.

Use these two-terminal commands for this project. The default `composer setup` and `composer dev` scripts operate on Laravel's bundled assets, not the React app in `frontend`; `composer setup` also generates a key and runs migrations. They are not shortcuts for this guide.

## 7. After pulling teammates' changes

Save and commit or otherwise preserve your own edits before pulling. From the repository root:

```powershell
git pull
cd backend/laravel
composer install
php artisan config:clear
php artisan migrate
cd ../../frontend
npm.cmd ci
```

Keep MySQL running for migrations. Stop the frontend server before `npm ci`, then restart both development servers. Check `.env.example` for newly added settings and copy the needed values into your existing `.env`; do not overwrite your local configuration or key.

## 8. Verify your setup

From `backend/laravel`:

```powershell
php artisan migrate:status
php artisan test
```

The tests currently include schema creation/rollback checks and a shopper foreign-key regression test. The schema tests explicitly use an isolated in-memory SQLite database, not your development MySQL database. They do not replace testing new migrations on a separate MySQL/MariaDB test database before merging.

From `frontend`:

```powershell
npm.cmd run build
npm.cmd run lint
```

The build should create `frontend/dist`. A large-chunk warning alone does not mean the build failed. At the time of this guide update, lint reports five existing errors in `SupervisorContext.jsx` and `SupervisorUI.jsx`; those need a separate fix and are not caused by backend setup. Investigate any additional errors.

For a manual MySQL migration check, first create a separate empty database named `grocerease_migration_test` using the same creation method as above. Then open a dedicated PowerShell terminal in `backend/laravel`:

```powershell
$env:DB_CONNECTION = "mysql"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3306"
$env:DB_DATABASE = "grocerease_migration_test"
php artisan config:clear
php artisan migrate
php artisan migrate:status
```

This uses the credentials from your local `.env`. The database must be empty for a first-run migration check; do not reuse a populated shared database. Close this terminal when finished: its environment overrides take precedence over `.env` while it remains open.

## 9. Common setup errors

| Error | What to check |
| --- | --- |
| `php` is not recognized | Add the PHP folder to PATH and fully restart VS Code. Use the fallback below meanwhile. |
| `composer` is not recognized | Install Composer using the official Windows installer, selecting XAMPP's PHP, then fully restart VS Code. |
| `Could not open input file: artisan` | Your terminal must be in `backend/laravel`. |
| Missing `vendor/autoload.php` or red underlines on Laravel classes | Run `composer install` in `backend/laravel`; let the editor finish indexing. |
| Missing ZIP support or another PHP extension | Check `php --ini`, enable the named extension in that file, and confirm with `php -m`. |
| `could not find driver` | Enable `pdo_mysql` for MySQL or `pdo_sqlite` for the tests in the PHP configuration used by your terminal. |
| Database connection refused | Start MySQL in XAMPP and check `DB_HOST`/`DB_PORT`. |
| Access denied for database user | Correct `DB_USERNAME`/`DB_PASSWORD` in `.env`, then run `php artisan config:clear`. |
| Unknown database | Create the database matching `DB_DATABASE`. |
| Missing application encryption key | For a new local `.env`, run `php artisan key:generate`. |
| Table already exists | Check the selected database and `migrate:status`; coordinate existing-schema problems rather than dropping data. |
| Laravel still connects to SQLite or the wrong database | Clear cached config and close terminals with old `$env:DB_*` overrides. |
| npm says scripts are disabled | Use `npm.cmd` as shown above; no execution-policy change is required. |
| npm reports `EBADENGINE` | Install Node.js 24 LTS and reopen the terminal; verify `node --version`. |
| Port 8000 or 5173 is busy | Stop the old development server with Ctrl+C, then retry. Keep the frontend port at 5173 unless you also update CORS. |

**PHP fallback while fixing PATH:**

From the repository root:

```powershell
cd backend/laravel
& "C:\xampp\php\php.exe" artisan serve --host=127.0.0.1 --port=8000
```

The `&` tells PowerShell to execute the quoted program path. Adjust the path if XAMPP is installed elsewhere. You can use the same prefix for other Artisan commands, for example `& "C:\xampp\php\php.exe" artisan migrate:status`.

## 10. What belongs in Git

Commit source code, migrations, tests, documentation, `.env.example`, and intentional dependency changes together with their lockfiles. Keep `.env`, credentials, `vendor`, `node_modules`, generated frontend `dist`, and local database data out of commits. The project already ignores these generated/private paths.

Each teammate needs their own local database and `.env`. Pushing migrations shares the instructions for creating tables, not your local database or its records.
