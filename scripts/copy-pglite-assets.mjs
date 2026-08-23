import { access, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const src = join("node_modules", "@electric-sql", "pglite", "dist");
const dests = [
  join(".vercel", "output", "functions", "__server.func", "_libs"),
  join(".output", "server", "_libs"),
];
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

for (const dest of dests) {
  try {
    await access(dest);
  } catch {
    try {
      await mkdir(dest, { recursive: true });
    } catch {
      continue;
    }
  }
  for (const file of files) {
    try {
      await copyFile(join(src, file), join(dest, file));
    } catch {
      // dist files missing in some installs
    }
  }
}
