# PixelPoint Cloud Reporting

Windows/SQL Anywhere reporting connector, authenticated dashboard, API and local/PostgreSQL storage.

## Setup

Install Node.js 24, then run npm install. Create a new local bootstrap configuration:

    node scripts/init-config.mjs

This generates unique random connector keys. config/cloud.json is a private runtime file and is intentionally excluded from Git. Never upload database passwords, keys, local-live, utility-state, outboxes, backups or sales records.

For an authenticated synthetic demo, run START-LOGIN-DASHBOARD.cmd on Windows and create your own administrator account. The demo has no shared sign-in token.

For cloud use, configure your real stores/admin accounts, PostgreSQL connection, HTTPS and connector credentials. The GitHub Actions jobs test isolated synthetic data; they are not a production hosting service.

## Testing

    npm test

The Actions workflow also starts an isolated PostgreSQL 17 instance, runs browser checks and compiles/self-tests the Windows utility and installer. See GITHUB-TESTING.md. Real ODBC/printer/reboot tests require the target Windows computer.

## Optional reporting adapters

See queries/optional/README.md. Source-specific SQL must be approved and reconciled before enabling it. Do not infer unsupported refunds, voids, discounts, categories or tender allocations from the four supplied queries.
