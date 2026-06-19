export class UnipileLinkedinAccountUnusableError extends Error {
  readonly accountId?: string;

  constructor(message: string, options?: { accountId?: string; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'UnipileLinkedinAccountUnusableError';
    this.accountId = options?.accountId?.trim() || undefined;
  }
}
