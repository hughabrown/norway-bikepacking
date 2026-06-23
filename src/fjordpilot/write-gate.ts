export interface WriteGateInput {
  confirmed: boolean;
  providedGate?: string;
  expectedGate: string;
}

export type WriteGateResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateWriteGate(input: WriteGateInput): WriteGateResult {
  if (!input.confirmed) {
    return { ok: false, error: "confirmation is required" };
  }
  if (!input.expectedGate) {
    return { ok: false, error: "server write gate is not configured" };
  }
  if (!input.providedGate || input.providedGate !== input.expectedGate) {
    return { ok: false, error: "the write gate was invalid" };
  }
  return { ok: true };
}
