# GrocerEase backend: local setup

This is a Laravel 12 API scaffold using MySQL or MariaDB. The React frontend lives in `../../frontend`.

## What creates the database?

- Starting MySQL starts the database server.
- `CREATE DATABASE` creates an empty database once.
- `php artisan migrate` runs pending migration files to create or change tables. Laravel records which migrations have run.
- `php artisan serve` starts the API web server. It does not create databases or run migrations.

Laravel 12 can offer to create a missing database during an interactive `migrate` command if your database user has permission. Creating it explicitly makes the setup easier to follow. The existing `composer setup` script also runs migrations and builds Laravel's bundled assets; it is different from starting the server. Use the steps below for this separate React frontend.

## First-time setup on Windows with XAMPP

1. Install PHP 8.2+, Composer, and XAMPP's MySQL/MariaDB. Enable PHP's ZIP extension for Composer archive extraction. Restart your terminal after adding PHP and Composer to PATH.
2. Start **MySQL** in XAMPP Control Panel.
3. From the repository root, install the locked PHP dependencies:

   ```powershell
   cd backend/laravel
   composer install
   ```

4. Create your local configuration only if `.env` does not already exist:

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   ```

   Set these values in `.env` for a default local XAMPP installation:

   ```dotenv
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=grocerease_db
   DB_USERNAME=root
   DB_PASSWORD=
   ```

   Use your actual local credentials if they differ. An empty root password is for the default local XAMPP setup only. `.env` contains local secrets and is ignored by Git; `.env.example` is the shared template.

5. Create the empty database from PowerShell (once):

   ```powershell
   & C:/xampp/mysql/bin/mysql.exe --host=127.0.0.1 --user=root --execute="CREATE DATABASE grocerease_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

   Add `--password` to be prompted if your MySQL account has a password. If the database already exists, keep it and skip this command.

6. Generate an application key for a newly created `.env`, then apply migrations:

   ```powershell
   php artisan key:generate
   php artisan config:clear
   php artisan migrate
   php artisan migrate:status
   ```

   Do not regenerate an existing application's key during routine startup. All migration rows should show `Ran`. Do not use `migrate:fresh` on a database containing data you need: it drops tables.

## Every time you develop

Start MySQL in XAMPP, then run from `backend/laravel`:

```powershell
php artisan serve
```

Open `http://127.0.0.1:8000/up` to check that Laravel is running. Stop the server with Ctrl+C. API routes are in `routes/api.php`; `/api/user` requires authentication. Login and shopper account integration are still to be implemented.

Run the React frontend separately, from `frontend`, using `npm install` on initial setup and `npm run dev` to start it. The configured CORS origin is `http://localhost:5173`.

## After pulling changes

From `backend/laravel`, run `composer install` to install the locked dependency versions and `php artisan migrate` to apply any new migrations. Running `migrate` again without new migrations does not recreate the tables.

## Automated checks

```powershell
php artisan test
```

The schema regression tests explicitly use a separate in-memory SQLite database. They check foreign-key targets, migration rollback, and shopper restrictions without modifying your MySQL database. SQLite checks do not replace testing migrations against MySQL/MariaDB before release.

For a manual database check, create a separate empty database (for example `grocerease_migration_test`) and use temporary PowerShell settings before running migrations:

```powershell
$env:DB_CONNECTION = "mysql"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3306"
$env:DB_DATABASE = "grocerease_migration_test"
$env:DB_USERNAME = "root"
$env:DB_PASSWORD = ""
php artisan config:clear
php artisan migrate
php artisan migrate:status
```

These environment overrides last for this terminal session. Close it before working with your normal development database. If the migration files were already applied in a shared database, editing those files does not rerun them: coordinate a new corrective migration instead.
