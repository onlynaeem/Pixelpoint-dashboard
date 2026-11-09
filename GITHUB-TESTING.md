# GitHub testing setup

Use a new private repository, for example onlynaeem/pixelpoint-cloud-reporting, separate from e-Accounts. Upload only the sanitized source package. Do not upload a restaurant database, credentials, utility-state, local-live, outbox, backups or logs. The included bootstrap config contains synthetic examples only. The Windows executable is built by Actions rather than committed.

## Automated hosted jobs

| Job | Tests |
| --- | --- |
| Linux/PostgreSQL | Local Node test suite, fresh PostgreSQL 17 integration: migrations, conflicts, rollback, snapshots/replay and persistence |
| Browser | Chromium back-office, schedules, key rotation, pause/resume and reconciliation using synthetic SQLite data |
| Windows | Node tests, 32-bit utility compilation/self-test, PowerShell syntax and installer build; publishes generated executables as Actions artifacts |

The workflow runs on pushes, pull requests and manual dispatch. It uses synthetic CI credentials only. No production secrets are required. The supplied Actions workflow has not been run until a repository push succeeds and GitHub reports a result.

## What hosted GitHub cannot establish

The hosted runner's 127.0.0.1 is that runner, not the restaurant computer. Its System DSN is not your PixelSqlbase DSN. GitHub Actions also is not the production reporting API/hosting service.

Actual ODBC extraction, SQL Anywhere 10 driver compatibility, restaurant printer behavior and local reboot/task acceptance must run on the target Windows PC. A dedicated self-hosted runner can run trusted manual tests there later, but it requires runner installation and carefully restricted execution. Do not run untrusted pull-request code on a machine that can read restaurant credentials/data. No self-hosted runner or new persistent access is configured by this package.

The four live queries and native 32-bit utility have already passed local connection checks for the verified configuration; cloud production deployment and broader source mappings remain separate acceptance items.
