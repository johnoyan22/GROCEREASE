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
FRONTEND_URL=http://localhost:5173

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=grocerease
DB_USERNAME=root
DB_PASSWORD=

SESSION_DRIVER=database
SESSION_DOMAIN=null
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173,localhost:8000,127.0.0.1:8000

CACHE_STORE=file
QUEUE_CONNECTION=sync

MAIL_MAILER=log
MAIL_LOG_CHANNEL=single
MAIL_FROM_ADDRESS="no-reply@grocerease.test"
MAIL_FROM_NAME="${APP_NAME}"
```

These settings are for local development. Laravel writes generated emails to
`backend/laravel/storage/logs/laravel.log`; it does not deliver them to an inbox.
Keep logs private because verification emails can contain signed links.

Replace existing environment entries instead of appending duplicates. Each
variable should appear only once. Your actual `.env` needs a generated
application key; the blank key in `.env.example` is a template placeholder.

File cache avoids requiring a cache table, and the synchronous queue avoids
requiring a jobs table or queue worker for this local setup. Database sessions
remain enabled and use the existing sessions table.

When updating an existing installation, change the relevant settings in your
existing `.env`. Do not overwrite it with `.env.example`, regenerate an existing
`APP_KEY`, or replace local database credentials.

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

The seeded Shopper starts unverified and is redirected to `/verify-email`
after login. Request a verification email there, then use its signed link from
the local Laravel log. Staff dashboard access remains unchanged. Do not
manually fill verification dates or regenerate the application key to bypass
verification.

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

### Before migrating an older database

For an existing database with a `profiles` table, export a private SQL backup
and stop the local backend before reviewing phone data. First-time empty
database installations can follow the normal setup instructions instead.

Before applying phone uniqueness, check for numbers that become duplicates
after normalization:

```sql
SELECT
    CASE
        WHEN phone_number REGEXP '^09[0-9]{9}$'
            THEN CONCAT('+63', SUBSTRING(phone_number, 2))
        ELSE phone_number
    END AS normalized_phone,
    COUNT(*) AS account_count
FROM profiles
GROUP BY normalized_phone
HAVING COUNT(*) > 1;
```

Also check for unsupported formats:

```sql
SELECT profile_id, user_id, phone_number
FROM profiles
WHERE phone_number NOT REGEXP '^(09[0-9]{9}|[+]639[0-9]{9})$';
```

If either query returns rows, stop and resolve the records with the team using
the correct contact information. Do not delete accounts to free numbers,
invent replacement numbers for real users, or bypass the unique constraint.
Older development seeds used the same phone for Supervisor and Inventory
Worker; do not assume an existing database is ready for the unique index.

Once both checks return no rows and the backup is saved, normalize valid local
numbers:

```sql
UPDATE profiles
SET phone_number = CONCAT('+63', SUBSTRING(phone_number, 2))
WHERE phone_number REGEXP '^09[0-9]{9}$';
```

Then follow the update commands below and run `php artisan migrate`.

Keep existing migration-history records and historical migration files.
Do not use `migrate:fresh` or reseed an important database to resolve duplicate
contact details. Development credential seeders can overwrite seeded account
passwords and contact information.

### Apply the update

Review the environment settings in first-time setup step 4 before running the
commands below. Update your existing `.env` to use file cache, the synchronous
queue, and the correct backend/frontend URLs, preserving the application key
and database credentials. Clearing configuration first ensures subsequent
cache-clear commands do not use an old database cache configuration.

After pulling new code, install any changed dependencies and apply new
migrations:

```powershell
git pull --ff-only origin backend-clean-rebuild

cd backend\laravel
composer install
php artisan config:clear
php artisan optimize:clear
php artisan migrate

cd ..\..\frontend
npm install
```

Do not copy `.env.example` over an existing `.env` during routine updates; that
would overwrite local database configuration. Review `.env.example` manually
if a pull introduces new environment variables.

Run `php artisan db:seed` only when intentionally refreshing the local
development accounts; the credential seeders can reset their passwords and
contact information.

## Removing abandoned SMS OTP storage from an existing database

The project is switching to Laravel signed-link email verification. Phone
numbers remain contact information, with normalization and one unique number
per account. Email verification does not prove ownership of a phone number.
The unused SMS OTP model and service have been removed from application code.

For an existing installation that already ran the SMS-related migrations:

1. Stop your local Laravel server while performing this cleanup. Arrange a
   maintenance window with teammates if the database is shared.
2. Export the correct database before proceeding. In XAMPP phpMyAdmin, select
   your application database, open **Export**, choose **Quick / SQL**, and save
   the export outside the repository. Keep it private: it contains account
   information and password hashes.
3. In that database's SQL tab, check that the abandoned storage is unused:

   ```sql
   SELECT COUNT(*) AS otp_records FROM phone_verifications;
   SELECT COUNT(*) AS verified_phone_profiles
   FROM profiles WHERE phone_verified_at IS NOT NULL;
   SELECT COUNT(*) AS users_before FROM users;
   SELECT COUNT(*) AS profiles_before FROM profiles;
   ```

   Both SMS-related counts should be zero. If either is nonzero, stop and
   review/export that data with the team. The cleanup migration deliberately
   refuses to discard it; do not bypass the guard or blindly delete records.
4. From the repository root, apply the pending migration:

   ```powershell
   cd backend\laravel
   php artisan migrate:status
   php artisan migrate
   php artisan migrate:status
   ```

   The migration `2026_10_12_152830_remove_abandoned_phone_verification_storage`
   should report `Ran`. It drops only `phone_verifications` and
   `profiles.phone_verified_at`. Users, profiles, phone numbers, the unique
   phone index, and `users.email_verified_at` are preserved.
5. In phpMyAdmin, confirm the result:

   ```sql
   SHOW TABLES LIKE 'phone_verifications';
   SHOW COLUMNS FROM profiles LIKE 'phone_verified_at';
   SHOW COLUMNS FROM users LIKE 'email_verified_at';
   SHOW INDEX FROM profiles WHERE Key_name = 'profiles_phone_number_unique';
   SELECT COUNT(*) AS users_after FROM users;
   SELECT COUNT(*) AS profiles_after FROM profiles;
   ```

   The first two queries should return no rows. The email column and unique
   phone index should still exist, and account/profile counts should match
   their pre-cleanup values. Restart Laravel and check registration/login.

Keep the historical `add_phone_verified_at_to_profiles_table` and
`create_phone_verifications_table` migration files. They document changes that
already ran; deleting them does not clean an existing database. A fresh
installation runs the old migrations followed by this cleanup, ending without
SMS OTP storage. Do not use `migrate:fresh`, reset the database, manually delete
migration-history rows, or roll back unrelated migrations for this cleanup.
Rolling back the cleanup restores empty SMS structures only; it does not
restore discarded data or the removed PHP files. Database restoration requires
your private export and a separate, reviewed recovery process.

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
   `php artisan key:generate` for a new installation. For an existing
   installation, first restore its original key from a private backup if
   available. Replacing a key invalidates old cookies and signed links, and
   prevents decryption of data encrypted using the old key.
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
| `No application encryption key has been specified` | `APP_KEY` is missing | Restore the existing key if available; generate a key for a new installation |
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

Authentication uses Laravel Sanctum session cookies and CSRF protection.
Public registration creates a Shopper user and its Profile together, hashes
the password, and stores Philippine phone numbers in `+639XXXXXXXXX` format.
Each phone number can belong to only one account.

Laravel signed-link email verification is implemented. Registration generates
a verification notification; authenticated users can request another link.
Verification checks the signed URL, expiry, account ID, and current email
before recording `users.email_verified_at`.

The React `/verify-email` page shows instructions, resend controls, current
verification status, and a logout option. Unverified Shoppers are redirected
there instead of entering their dashboard. Existing staff dashboard access is
unchanged; the team must separately decide its staff-verification policy.

Frontend route guards control navigation only. Business API endpoints must
also enforce authentication, appropriate roles, and email verification as
those modules are connected.

### Local email verification testing

The default development configuration uses `MAIL_MAILER=log`. Generated emails
are written to `backend/laravel/storage/logs/laravel.log`, not delivered to an
inbox. Real inbox delivery requires a separately configured mail provider.

1. Register a test Shopper with an unused email and phone number.
2. Sign in with that account at `http://localhost:5173`.
3. Open `storage/logs/laravel.log` locally and find its most recent
   `Subject: Verify Email Address` message.
4. Copy the complete backend verification URL, including its `expires` and
   `signature` parameters.
5. Open the link in the same browser while signed in to the matching account.
6. Confirm the verification page shows success and permits dashboard navigation.

Do not change the link's host, port, or query parameters. Use `localhost`
consistently. If opening the link redirects to login, sign in and reopen the
original link afterward.

If the email was verified in another tab, use the verification page's
check-status button to fetch the latest account status.

Never share signed links, application keys, credentials, or complete logs.
Do not manually fill `email_verified_at` to bypass verification. URL display
parameters such as `status=verified` are not proof that an account is verified.

Registration is limited to six requests per minute. Verification-link requests
are limited to six per minute for the authenticated user. Resend is limited to
one request per minute for the authenticated user. The browser countdown is
only a convenience; Laravel enforces the resend limit.

### Automated checks

From `backend/laravel`:

```powershell
php vendor/bin/phpunit --do-not-cache-result
```

Database feature tests assert that they use SQLite in memory before running
migrations. Notifications are faked or use test-only mail storage. These tests
must not write to the developer's MySQL database.

The current suite includes 36 test cases covering phone normalization,
duplicate contacts, shopper-only public registration, transaction rollback,
verification notifications and signed links, rate limits, all four roles'
login, and session logout. Backend tests do not replace the browser checks.

From `frontend`:

```powershell
npx --no-install eslint src/services/api.js src/components/Shoppers/registerForm.jsx src/components/auth/loginForm.jsx src/components/auth/ProtectedRoute.jsx src/routes/AppRoutes.jsx src/pages/auth/VerifyEmailPage.jsx
npm run build
```

Some backend tests deliberately simulate failures. Corresponding test-warning
log entries are expected and do not by themselves prove that a real shopper's
registration failed.

SMS OTP is no longer active. Historical SMS-related migrations remain so
existing installations and fresh installations reach the same final schema.

Most business screens still use local mock data. Phone uniqueness does not
verify phone ownership or implement account banning. Real email delivery,
staff-verification policy, and production hardening remain separate work.

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
