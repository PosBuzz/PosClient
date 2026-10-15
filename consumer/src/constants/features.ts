/**
 * Bulk Excel import is off unless the build sets VITE_IMPORT_ENABLED=true.
 * The backend enforces the same switch (IMPORT_ENABLED), so turn on both.
 */
export const IMPORT_ENABLED = import.meta.env.VITE_IMPORT_ENABLED === "true";
