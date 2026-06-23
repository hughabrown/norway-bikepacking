import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_API_BASE_URL = "https://fjordpilot-api.hughbrown.workers.dev";
const DEFAULT_MODEL_LABEL = "codex-config-default";

export function safeJobId(id) {
  return String(id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildRunnerPrompt(job) {
  return [
    "You are the FjordPilot deep-analysis runner.",
    "Produce the final user-facing answer for this queued Norway bikepacking planning request.",
    "This is analysis only. Do not edit files, create commits, open PRs, or change repository state.",
    "You may read the repository and reason over the provided trip context.",
    "Keep the answer concise enough to be spoken by a voice assistant, but include the concrete reasoning Hugh needs.",
    "Separate facts from recommendations and flag anything that needs same-day live verification.",
    "",
    `Request id: ${job.id}`,
    `Variant: ${job.variant}`,
    `Analysis type: ${job.analysisType}`,
    `Question: ${job.question}`,
    "",
    "Stored analysis prompt and route context:",
    job.prompt,
  ].join("\n");
}

export function buildCodexArgs({ model, repoRoot, outputPath } = {}) {
  const args = [
    "exec",
    "--sandbox",
    "read-only",
    "--ephemeral",
    "--cd",
    repoRoot,
    "--output-last-message",
    outputPath,
  ];

  if (model) {
    args.push("--model", model);
  }

  args.push("-");
  return args;
}

export function runCodexAnalysis(job, options) {
  const repoRoot = options.repoRoot;
  const model = options.model;
  const codexBin = options.codexBin ?? "codex";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fjordpilot-deep-"));
  const outputPath = path.join(tmpDir, "answer.md");
  const args = buildCodexArgs({ model, repoRoot, outputPath });
  const prompt = buildRunnerPrompt(job);

  const result = spawnSync(codexBin, args, {
    cwd: repoRoot,
    input: prompt,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || "Codex exited without stderr.";
    throw new Error(`Codex analysis failed with status ${result.status}: ${stderr}`);
  }

  const answer = fs.readFileSync(outputPath, "utf8").trim();
  if (answer.length < 20) {
    throw new Error("Codex analysis produced an empty or too-short answer.");
  }

  return answer;
}

export async function apiPost(baseUrl, token, pathName, body) {
  const response = await fetch(new URL(pathName, baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`${pathName} failed with ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function claimNextJob(options) {
  return apiPost(
    options.apiBaseUrl,
    options.adminToken,
    "/api/fjordpilot/admin/deep-analysis/claim-next",
    {},
  );
}

export async function completeJob(options, job, answer) {
  return apiPost(
    options.apiBaseUrl,
    options.adminToken,
    "/api/fjordpilot/admin/deep-analysis/complete",
    {
      request_id: job.id,
      answer,
      model: options.model || DEFAULT_MODEL_LABEL,
      runner: options.runnerName,
    },
  );
}

export async function failJob(options, job, error) {
  return apiPost(
    options.apiBaseUrl,
    options.adminToken,
    "/api/fjordpilot/admin/deep-analysis/fail",
    {
      request_id: job.id,
      error: error instanceof Error ? error.message : String(error),
      runner: options.runnerName,
    },
  );
}

export async function runOnce(options) {
  const claim = await claimNextJob(options);
  if (claim.status === "empty") {
    return { ok: true, status: "empty" };
  }

  const job = claim.job;
  try {
    const answer = runCodexAnalysis(job, options);
    const completion = await completeJob(options, job, answer);
    return { ok: true, status: "completed", request_id: job.id, completion };
  } catch (error) {
    await failJob(options, job, error);
    throw error;
  }
}

function parseArgs(argv) {
  return {
    once: argv.includes("--once"),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot =
    process.env.FJORDPILOT_REPO_ROOT || path.resolve(moduleDir, "..", "..");
  const adminToken = process.env.FJORDPILOT_ADMIN_TOKEN || process.env.FJORDPILOT_TOOL_TOKEN;

  if (!adminToken) {
    throw new Error("Set FJORDPILOT_ADMIN_TOKEN or FJORDPILOT_TOOL_TOKEN before running.");
  }
  if (!args.once) {
    throw new Error("Use --once. Hermes should schedule repeated one-shot runs.");
  }

  const result = await runOnce({
    apiBaseUrl: process.env.FJORDPILOT_API_BASE_URL || DEFAULT_API_BASE_URL,
    adminToken,
    repoRoot,
    model: process.env.FJORDPILOT_DEEP_ANALYSIS_MODEL?.trim() || undefined,
    codexBin: process.env.FJORDPILOT_CODEX_BIN || "codex",
    runnerName: process.env.FJORDPILOT_RUNNER_NAME || "hermes-codex",
  });

  console.log(JSON.stringify(result, null, 2));
}
