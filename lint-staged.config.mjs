// Read-only checks; never stash or auto-format the owner's mixed working tree.
export default {
  'backend/**/*.ts': () => 'npm run lint:check --prefix backend',
  'consumer/src/**/*.{ts,tsx}': () => 'npm run lint:check --prefix consumer',
  'admin/src/**/*.{ts,tsx}': () => 'npm run lint:check --prefix admin',
};
