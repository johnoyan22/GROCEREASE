# GrocerEase Frontend

GrocerEase is currently under frontend development using **React**, **Vite**, and **Tailwind CSS**.

The README will be updated later when backend development begins.

## Requirements

Make sure these are installed:

* Node.js
* npm
* Git

Check your versions:

```bash
node --version
npm --version
git --version
```

## Clone the Repository

```bash
git clone <repository-url>
```

Then open the project folder:

```bash
cd GrocerEase
```

## Go to the Frontend Folder

```bash
cd frontend
```

## Install Dependencies

```bash
npm install
```

This installs the dependencies listed in `package.json`.

## Run the Development Server

```bash
npm run dev
```

Vite will start the local development server.

Open the local URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Tech Stack

* React
* Vite
* Tailwind CSS
* JavaScript

## Project Status

Frontend development is currently partially Done.

---

## Backend Setup

GrocerEase's backend is built with **Laravel** and **MySQL**, using **Laravel Sanctum** for API authentication.

### Requirements

Make sure these are installed:

* PHP (8.2 or higher)
* Composer
* MySQL (via XAMPP or standalone)

Check your versions:

```bash
php -v
composer -V
```

### PHP Extensions Required

Enable these extensions in your `php.ini` (remove the leading `;`):

```ini
extension=zip
extension=gd
extension=fileinfo
extension=mbstring
extension=curl
extension=pdo_mysql
```

Restart your terminal after editing, then verify with `php -m`.

### Setup Steps

```bash
cd backend/laravel
composer install
cp .env.example .env
```

Open `.env` and set your local database credentials:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=grocerease_db
DB_USERNAME=root
DB_PASSWORD=

FRONTEND_URL=http://localhost:5173
```

Then run:

```bash
php artisan key:generate
```

Create an empty database named `grocerease_db` (via phpMyAdmin or MySQL CLI), then run migrations:

```bash
php artisan migrate
```

Start the backend server:

```bash
php artisan serve
```

The API will run at `http://127.0.0.1:8000`.

### Notes

* Don't commit your `.env` file — only `.env.example` is tracked.
* Run `composer install` after pulling changes, in case new packages were added.
* Run `php artisan migrate` after pulling new migration files.
* All `php artisan` commands must be run from inside `backend/laravel`.

### Troubleshooting

* **`php`/`composer` not recognized** — not added to PATH, or terminal needs restarting.
* **`Could not open input file: artisan`** — you're not inside `backend/laravel`.
* **Zip extension missing during `composer install`** — enable `extension=zip` in `php.ini`.
* **Migration errors about existing tables** — run `php artisan migrate:fresh` (⚠️ wipes local data).



### Troubleshooting

#### `php` is not recognized in PowerShell (`php -v` fails)

This means PHP isn't added to your system PATH yet.

1. Find where PHP is installed. If you're using XAMPP, it's usually:

C:\xampp\php

2. Search "Environment Variables" in the Windows search bar → open **Edit the system environment variables**.
3. Click **Environment Variables**.
4. Under **System variables**, select `Path` → click **Edit** → **New**.
5. Add the PHP folder path (e.g. `C:\xampp\php`) → click **OK** on all windows.
6. **Fully close and reopen your terminal** (and VS Code, if using its integrated terminal) — PATH changes won't apply to already-open windows.
7. Test again:
```bash
   php -v
```

If it still fails, open a fresh PowerShell window (not through VS Code) and check if PHP shows in your PATH:
```bash
$env:Path -split ';' | Select-String 'php'
```
If nothing prints, the PATH entry didn't save — repeat the steps above.

---

#### `composer` is not recognized (`composer -v` fails)

Composer isn't installed yet.

1. Download the installer from https://getcomposer.org/download/ (`Composer-Setup.exe`).
2. Run it. When asked to locate your PHP executable, it should auto-detect it (e.g. `C:\xampp\php\php.exe`). If not, browse to it manually.
3. Choose **Install for all users (recommended)** if it's your own machine.
4. Finish the install, then **fully close and reopen your terminal**.
5. Test again:
```bash
   composer -V
```

---

#### `Could not open input file: artisan`

This means you're not inside the Laravel project folder. All `php artisan` commands must be run from inside `backend/laravel`.

```bash
cd backend/laravel
```

Then retry your command.

---

#### `The zip extension and unzip/7z commands are both missing` (during `composer install` or `composer create-project`)

The PHP `zip` extension isn't enabled.

1. Open `php.ini` (for XAMPP: `C:\xampp\php\php.ini`) in a text editor.
2. Search for:

;extension=zip

3. Remove the semicolon so it reads:

extension=zip

4. Save the file, then close and reopen your terminal.
5. Confirm it's enabled:
```bash
   php -m
```
   Look for `zip` in the list.
6. Retry your original command.

---

#### `requires ext-gd * which is missing from your platform` (when installing a package)

Same idea as the `zip` issue above, but for the `gd` extension (used for image processing, e.g. QR code generation).

1. Open `php.ini`.
2. Find `;extension=gd` and remove the semicolon:

extension=gd

3. Save, restart your terminal, and confirm with `php -m`.
4. Retry the package install.

> Note: `php.ini` is shared across all PHP projects on your machine — once you enable an extension, it stays enabled for future projects too. You'll only need to repeat this if a new project requires an extension you haven't enabled yet.

---

#### Migration fails with `table "X" already exists`

This usually means two migrations are trying to create a table with the same name (often a conflict between Laravel's default `users` table and a custom one).

* Check your migration files for duplicate `Schema::create('table_name', ...)` calls using the same table name.
* Rename one of them to something distinct (e.g. `grocer_users` instead of `users`), and update any foreign key references (`->constrained('table_name')`) accordingly.
* If your local database is in a broken/partial state from a failed migration, reset it with:
```bash
  php artisan migrate:fresh
```
  ⚠️ This drops **all** tables and re-runs every migration from scratch — only use this in local development, as it deletes existing data.

---

#### Laravel is connecting to SQLite instead of MySQL

If errors mention `Connection: sqlite` even though `.env` is set to MySQL, Laravel is likely using a cached config.

```bash
php artisan config:clear
```

Then retry your command.
