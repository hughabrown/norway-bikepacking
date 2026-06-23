import { DEFAULT_VARIANT } from "./types";
import { validateWriteGate } from "./write-gate";

export type TripNoteCategory = "decision" | "mechanical" | "food" | "weather" | "lodging" | "follow_up";

export interface SaveTripNoteInput {
  day?: number;
  variant?: string;
  location?: string;
  category: TripNoteCategory;
  note: string;
  confirmed: boolean;
  write_gate?: string;
}

export interface PersistedTripNote {
  id: string;
  createdAt: string;
  day: number | undefined;
  variant: string;
  location: string | undefined;
  category: TripNoteCategory;
  note: string;
}

export interface SaveTripNoteEnv {
  writeGate: string;
  now: () => string;
  id: () => string;
}

export type SaveTripNoteResult =
  | { ok: true; note: PersistedTripNote }
  | { ok: false; error: string };

const allowedCategories: TripNoteCategory[] = ["decision", "mechanical", "food", "weather", "lodging", "follow_up"];

export function prepareTripNote(input: SaveTripNoteInput, env: SaveTripNoteEnv): SaveTripNoteResult {
  const gate = validateWriteGate({
    confirmed: input.confirmed,
    ...(input.write_gate ? { providedGate: input.write_gate } : {}),
    expectedGate: env.writeGate
  });

  if (!gate.ok) {
    const gateMessage = gate.error === "write gate was invalid" ? "the write gate was invalid" : gate.error;
    return { ok: false, error: `Trip note was not saved because ${gateMessage}.` };
  }

  if (!allowedCategories.includes(input.category)) {
    return { ok: false, error: `Trip note was not saved because category ${input.category} is not supported.` };
  }

  const note = input.note.trim();
  if (note.length < 3) {
    return { ok: false, error: "Trip note was not saved because the note text was too short." };
  }

  return {
    ok: true,
    note: {
      id: env.id(),
      createdAt: env.now(),
      day: input.day,
      variant: input.variant?.trim() || DEFAULT_VARIANT,
      location: input.location?.trim() || undefined,
      category: input.category,
      note
    }
  };
}
