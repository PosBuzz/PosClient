/** Browser-safe IPv4 detection; direct API addresses are never tenant names. */
export function isIPv4Host(host: string): boolean {
  return (
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) &&
    host.split(".").every((part) => Number(part) <= 255)
  );
}
