import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readAgentConfig(): {
  conversation_config: {
    agent: {
      first_message: string;
      prompt: { prompt: string };
    };
    tts: {
      model_id: string;
      expressive_mode: boolean;
      suggested_audio_tags: Array<{ tag: string }>;
    };
  };
  workflow: {
    nodes: Record<string, { additional_prompt?: string }>;
    edges: Record<
      string,
      { forward_condition?: { type: string; condition?: string } }
    >;
  };
} {
  return JSON.parse(readText("agent_configs/PersonalAssistant.json"));
}

function speakerFacingAgentText(): string {
  const config = readAgentConfig();
  return [
    readText("elevenlabs/fjordpilot-agent-prompt.md"),
    config.conversation_config.agent.first_message,
    config.conversation_config.agent.prompt.prompt,
    ...Object.values(config.workflow.nodes)
      .map((node) => node.additional_prompt)
      .filter((text): text is string => Boolean(text)),
  ].join("\n\n");
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

  it("does not mandate one canned phrase for deep-analysis acknowledgements", () => {
    const speakerText = speakerFacingAgentText();

    expect(speakerText).not.toMatch(/say exactly/i);
    expect(speakerText).not.toMatch(/start(?:s)? (?:broad planning requests )?(?:with|by saying) exactly/i);
  });

  it("keeps machine protocol terms out of normal spoken behavior", () => {
    const speakerText = speakerFacingAgentText();

    expect(speakerText).not.toMatch(/\bqueued\b/i);
    expect(speakerText).not.toMatch(/\bstatus\b/i);
    expect(speakerText).not.toMatch(/\bhandoff\b/i);
    expect(speakerText).not.toMatch(/\bsubagent\b/i);
    expect(speakerText).not.toMatch(/\bworkflow\b/i);
    expect(speakerText).not.toMatch(/write gate/i);
    expect(speakerText).not.toMatch(/write_gate/i);
    expect(speakerText).not.toMatch(/request id/i);
    expect(speakerText).not.toMatch(/request_id/i);
    expect(speakerText).not.toMatch(/^Action:/im);
    expect(speakerText).not.toMatch(/^Answer:/im);
    expect(speakerText).not.toMatch(/ok:\s*true/i);
  });

  it("keeps expressive mode enabled with a small set of intentional v3 tags", () => {
    const config = readAgentConfig();
    const tags = config.conversation_config.tts.suggested_audio_tags.map(({ tag }) =>
      tag.toLowerCase(),
    );
    const speakerText = speakerFacingAgentText();

    expect(config.conversation_config.tts.model_id).toBe("eleven_v3_conversational");
    expect(config.conversation_config.tts.expressive_mode).toBe(true);
    expect(tags).toEqual(expect.arrayContaining(["warmly", "thoughtfully", "slow"]));
    expect(tags.length).toBeLessThanOrEqual(5);
    expect(speakerText).toMatch(/\[slow\]/);
    expect(speakerText).toMatch(/Do not use expressive tags in every response/i);
  });

  it("answers whole-trip must-see highlights without the async deep path", () => {
    const config = readAgentConfig();
    const speakerText = speakerFacingAgentText();
    const startTool = JSON.parse(readText("tool_configs/start_deep_trip_analysis.json")) as {
      description: string;
    };
    const routeConcierge = config.workflow.nodes.route_concierge;
    const routeToDeep = config.workflow.edges.route_to_deep_analysis;

    expect(speakerText).toMatch(
      /whole-trip top highlights, must-see stops, best moments, or what not to miss/i,
    );
    expect(speakerText).toMatch(
      /Do not call `start_deep_trip_analysis` for whole-trip highlight questions/i,
    );
    expect(routeConcierge).toBeDefined();
    expect(routeToDeep).toBeDefined();
    expect(routeConcierge?.additional_prompt).toMatch(/whole-trip top highlights/i);
    expect(routeToDeep?.forward_condition?.condition).toMatch(
      /Simple whole-trip top highlights and must-see summaries should stay with the route concierge/i,
    );
    expect(startTool.description).not.toMatch(/\btrip highlights\b/i);
    expect(startTool.description).toMatch(/next-five-days highlights/i);
  });
});
