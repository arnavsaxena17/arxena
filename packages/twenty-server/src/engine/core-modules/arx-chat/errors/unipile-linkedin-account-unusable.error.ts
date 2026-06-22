export class UnipileLinkedinAccountUnusableError extends Error {
  readonly accountId?: string;

  constructor(message: string, options?: { accountId?: string; cause?: unknown }) {
    super(message);
    this.name = 'UnipileLinkedinAccountUnusableError';
    this.accountId = options?.accountId?.trim() || undefined;

    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}
