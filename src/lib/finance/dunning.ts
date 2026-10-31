import { addDays } from "./period";

export interface DunningPolicy {
  /** days after the FAILED attempt at which to retry, e.g. [1, 3, 7] */
  retryDays: number[];
}

export const DEFAULT_DUNNING: DunningPolicy = { retryDays: [1, 3, 7] };

/**
 * Given the number of failed attempts so far (1 = first failure) and the date of
 * the latest failure, return the next retry date or null when retries are exhausted
 * (=> mark subscription past due and alert staff). Never marks anything paid.
 */
export function nextRetry(failedAttempts: number, lastFailureDate: string, policy: DunningPolicy = DEFAULT_DUNNING) {
  const idx = failedAttempts - 1;
  if (idx < 0) throw new Error("failedAttempts must be >= 1");
  if (idx >= policy.retryDays.length) return { retryOn: null as string | null, exhausted: true };
  return { retryOn: addDays(lastFailureDate, policy.retryDays[idx]), exhausted: false };
}
