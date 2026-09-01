# Account data imports

Super admins can run a one-way, point-in-time data import from one active
consumer account into another from **Admin → Consumers → Import data**.

## Selectable sections

- **Products**: products, variants, units, categories, brands, tags, and variant
  attributes. Inventory quantities, serials, price history, sales, and other
  ledger records are intentionally excluded.
- **Customers**: customer profiles. Sales and reward balances/history are
  intentionally excluded.
- **Vendors**: vendor contact profiles.
- **Branches**: branch profiles. The destination's existing main branch is
  preserved, and a newly imported branch is never marked as main.

The excluded transactional sections need their own reconciliation rules. They
must not be added to this copier as ordinary rows because stock and financial
history contain stateful relationships and audit invariants.

## Duplicate behavior

Each run chooses one policy:

- **Keep destination data (`SKIP`)**: matching rows remain unchanged; missing
  rows and missing child records are added.
- **Update destination matches (`UPDATE`)**: imported fields on matching rows
  are updated from the source.

The first run matches stable natural keys (for example product code/name,
customer phone, or vendor name) and records a source-ID to destination-ID map.
Later runs prefer this map, so a source rename continues to address the same
destination row. Ambiguous product name/code collisions are reported as
conflicts and are not guessed.

## Safety guarantees

- Source and destination must be different active accounts.
- The admin must type the destination subdomain before running the import.
- A database transaction makes every run all-or-nothing.
- An advisory lock allows only one import into a destination at a time.
- All foreign keys are remapped to destination-owned records.
- Product and branch plan limits are checked before records are inserted.
- Every attempt is retained in `consumer_data_imports`, including failures and
  its selected sections. Successful runs include created, updated, skipped,
  and conflict totals.

This is a snapshot import, not continuous synchronization. Run it again when a
customer wants to bring over newer source data.
