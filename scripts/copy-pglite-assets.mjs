import { access, copyFile } from "node:fs/promises";
import { join } from "node:path";

const src = join("node_modules", "@electric-sql", "pglite", "dist");
const dest = join(".vercel", "output", "functions", "__server.func", "_libs");
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

try {
  await access(dest);
} catch {
  process.exit(0);
}

for (const file of files) {
  await copyFile(join(src, file), join(dest, file));
}
