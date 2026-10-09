/* @license Enterprise */

// CUSTOMER: deducted from the workspace balance and shown to the customer.
// SYSTEM: platform overhead; cost is recorded but nothing is deducted.
// INTERNAL: evals, judges and dev traffic; cost is recorded but nothing is deducted.
// OFF: nothing is recorded at all.
export type BillingTreatment = 'CUSTOMER' | 'SYSTEM' | 'INTERNAL' | 'OFF';
