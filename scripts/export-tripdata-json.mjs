import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "tripdata.js");
const outDir = path.join(repoRoot, "src", "fjordpilot", "generated");
const outPath = path.join(outDir, "tripdata.json");

const source = fs.readFileSync(sourcePath, "utf8");
const context = {};
vm.createContext(context);
vm.runInContext(source, context, { filename: sourcePath });

if (!context.TRIP || typeof context.TRIP !== "object") {
  throw new Error("tripdata.js did not define a TRIP object");
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(context.TRIP, null, 2)}\n`);

const variantKeys = Object.keys(context.TRIP.variants || {});
console.log(`wrote ${path.relative(repoRoot, outPath)} with variants: ${variantKeys.join(", ")}`);
