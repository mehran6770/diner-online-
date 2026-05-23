# Security Specification - Diner Bank

## Data Invariants
- An account must have a unique ID, non-empty name, and non-negative balance (usually).
- Transactions must refer to an existing account.
- Balance updates and transaction records must happen atomically.

## The "Dirty Dozen" Payloads (Red Team Tests)
1. Creating an account with a negative balance.
2. Updating an account name to an empty string.
3. Deleting an account without authorization.
4. Increasing balance without a transaction record.
5. Decreasing balance without a transaction record.
6. Spoofing `timestamp` in a transaction.
7. Modifying a transaction record after creation.
8. Injecting a 1MB string into the `name` field.
9. Creating a transaction for a non-existent account.
10. Attempting to set balance to 1,000,000 via client SDK as a non-admin.
11. Reading private user info (if any was added).
12. Bulk deleting the entire `accounts` collection.

## Test Runner (Simplified for Rules Generation)
(This is a conceptual test runner as I will be deploying rules directly).
