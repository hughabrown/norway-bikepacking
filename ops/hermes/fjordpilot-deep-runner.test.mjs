import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCodexArgs,
  buildRunnerPrompt,
  safeJobId,
} from "./fjordpilot-deep-runner.mjs";

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

  it("uses the local Codex default model when no model is provided", () => {
    const args = buildCodexArgs({
      repoRoot: "/repo",
      outputPath: "/tmp/answer.md",
    });

    assert.equal(args.includes("--model"), false);
  });
});
