import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("ElevenLabs prompt contract", () => {
  it("does not instruct the voice agent to read deep-analysis request ids aloud", () => {
    const prompt = readText("elevenlabs/fjordpilot-agent-prompt.md");
    const agentConfig = readText("agent_configs/PersonalAssistant.json");
    const scenario = readText("test_configs/FjordPilot-10-next-five-days-v1.json");

    expect(prompt).not.toMatch(/give the request id/i);
    expect(agentConfig).not.toMatch(/give the request id/i);
    expect(scenario).not.toMatch(/reports? the queued request id/i);
  });
});
