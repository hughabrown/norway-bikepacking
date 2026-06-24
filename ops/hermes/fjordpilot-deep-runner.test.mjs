import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCodexArgs,
  buildCodexSpawnOptions,
  buildRunnerPrompt,
  safeJobId,
} from "./fjordpilot-deep-runner.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

describe("fjordpilot deep runner helpers", () => {
  it("sanitizes job ids for log and branch-safe labels", () => {
    assert.equal(safeJobId("Deep Job 123/ABC"), "deep-job-123-abc");
  });

  it("builds a read-only Codex prompt from the queued job", () => {
    const prompt = buildRunnerPrompt({
      id: "deep_1",
      variant: "besseggen",
      analysisType: "multi_day_highlights",
      question: "Can you give me the highlights of the next five days?",
      prompt: "Route context goes here.",
    });

    assert.match(prompt, /Do not edit files/);
    assert.match(prompt, /Can you give me the highlights/);
    assert.match(prompt, /Route context goes here/);
  });

  it("builds Codex exec args with read-only sandbox and output capture", () => {
    const args = buildCodexArgs({
      model: "gpt-5",
      repoRoot: "/repo",
      outputPath: "/tmp/answer.md",
    });

    assert.deepEqual(args, [
      "exec",
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--cd",
      "/repo",
      "--output-last-message",
      "/tmp/answer.md",
      "--model",
      "gpt-5",
      "-",
    ]);
  });

  it("builds Codex spawn options with a default timeout", () => {
    assert.deepEqual(buildCodexSpawnOptions({ repoRoot: "/repo" }), {
      cwd: "/repo",
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      timeout: 240000,
    });
    assert.equal(
      buildCodexSpawnOptions({ repoRoot: "/repo", timeoutMs: 120000 }).timeout,
      120000,
    );
  });

  it("uses the local Codex default model when no model is provided", () => {
    const args = buildCodexArgs({
      repoRoot: "/repo",
      outputPath: "/tmp/answer.md",
    });

    assert.equal(args.includes("--model"), false);
  });

  it("ships launchd scripts for repeated one-shot runs", () => {
    const runner = fs.readFileSync(
      path.join(moduleDir, "run-fjordpilot-deep-runner.zsh"),
      "utf8",
    );
    const installer = fs.readFileSync(
      path.join(moduleDir, "install-launchd-runner.zsh"),
      "utf8",
    );

    assert.match(
      runner,
      /security find-generic-password -s fjordpilot -a FJORDPILOT_TOOL_TOKEN -w/,
    );
    assert.match(runner, /mkdir "\$LOCK_DIR"/);
    assert.doesNotMatch(runner, /\nexec "\$NODE_BIN"/);
    assert.match(installer, /StartInterval/);
    assert.match(installer, /RunAtLoad/);
    assert.match(installer, /launchctl bootstrap/);
  });
});
