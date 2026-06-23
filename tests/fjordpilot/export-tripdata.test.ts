import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, test } from "vitest";

describe("tripdata export foundation", () => {
  test("tripdata.js defines TRIP and exported JSON contains expected variants", () => {
    const repoRoot = process.cwd();
    const tripdataPath = path.join(repoRoot, "tripdata.js");
    const tripdataSource = fs.readFileSync(tripdataPath, "utf8");
    const context: { TRIP?: Record<string, unknown> } = {};

    vm.createContext(context);
    vm.runInContext(tripdataSource, context, { filename: tripdataPath });

    expect(context).toHaveProperty("TRIP");
    expect(context.TRIP).toBeTypeOf("object");
    expect(context.TRIP).not.toBeNull();

    execSync("node scripts/export-tripdata-json.mjs", {
      stdio: "ignore",
      cwd: repoRoot,
    });

    const exportedPath = path.join(repoRoot, "src", "fjordpilot", "generated", "tripdata.json");
    const exportedTripData = JSON.parse(fs.readFileSync(exportedPath, "utf8"));

    expect(exportedTripData).toHaveProperty("variants");
    expect(exportedTripData.variants).toBeTypeOf("object");
    expect(Object.keys(exportedTripData.variants)).toContain("besseggen");
    expect(Object.keys(exportedTripData.variants)).toContain("gravel");
  });

  test("index.html prefers the besseggen variant when it is available", () => {
    const repoRoot = process.cwd();
    const indexPath = path.join(repoRoot, "index.html");
    const indexSource = fs.readFileSync(indexPath, "utf8");

    expect(indexSource).toContain("var current = variants.besseggen ? 'besseggen' : (variantKeys[0] || null);");
  });
});
