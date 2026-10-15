// X-PERM-001/002: permission names must agree across consumer UI, backend enums and the seed.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(root, p), "utf8");
const strings = (text) => [...text.matchAll(/(['"])([^'"]+)\1/g)].map((m) => m[2]);
const enumValues = (text) =>
  [...text.matchAll(/=\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
const seedArray = (text, name) => {
  const m = text.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`seed array ${name} not found`);
  return strings(m[1]);
};
const objectValues = (text) =>
  [...text.matchAll(/:\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);

const seed = read("backend/prisma/seed.ts");
const sets = {
  consumerUi: objectValues(read("consumer/src/constants/permissions.ts")),
  consumerEnum: enumValues(read("backend/src/auth/enums/consumerPermissions.enum.ts")),
  consumerSeed: seedArray(seed, "consumerPermissions"),
  adminEnum: enumValues(read("backend/src/auth/enums/adminPermissions.enum.ts")),
  adminSeed: seedArray(seed, "adminPermissions"),
};

let failed = false;
const compare = (id, aName, bName) => {
  const a = new Set(sets[aName]);
  const b = new Set(sets[bName]);
  const onlyA = [...a].filter((x) => !b.has(x));
  const onlyB = [...b].filter((x) => !a.has(x));
  if (onlyA.length || onlyB.length) {
    failed = true;
    console.error(`${id} FAIL ${aName} vs ${bName}: only in ${aName}=[${onlyA}] only in ${bName}=[${onlyB}]`);
  } else {
    console.log(`${id} ok ${aName} == ${bName} (${a.size})`);
  }
};
compare("X-PERM-001", "consumerUi", "consumerEnum");
compare("X-PERM-001", "consumerEnum", "consumerSeed");
compare("X-PERM-002", "adminEnum", "adminSeed");
process.exit(failed ? 1 : 0);
