let value = 0;
export const seq = (): number => ++value;
/** Restarts the counter so names, emails and subdomains come out the same on every run. */
export const resetSequence = (): void => {
  value = 0;
};
export const TEST_PASSWORD = 'PosBuzz!234';
