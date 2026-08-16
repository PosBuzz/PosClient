/**
 * Turns an API failure into something an operator can act on. An empty table
 * and a failed request look identical otherwise, which hides real problems like
 * a database that has not been migrated yet.
 */
export function describeError(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;

  if (status === 403) {
    return "Your account is missing the 'portfolio' permission. Ask an admin to grant it, then sign out and back in.";
  }
  if (status === 500) {
    return "The API returned an error. If this deployment is new, check that database migrations have been applied.";
  }
  if (status) {
    return `The API responded with ${status}.`;
  }
  return "The API could not be reached.";
}
