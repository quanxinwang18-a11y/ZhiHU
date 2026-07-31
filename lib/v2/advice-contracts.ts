export const adviceSlotIds = [
  "challenge_assumptions",
  "path_and_risk",
  "communication_and_action",
] as const;

export type AdviceSlotId = (typeof adviceSlotIds)[number];

export type PersonaKind = "public_method" | "organization_method";

export type PersonaSummary = {
  id: string;
  displayName: string;
  perspectiveLabel: string;
  kind: PersonaKind;
  summary: string;
};

export type AdvicePlanItem = {
  slot: AdviceSlotId;
  slotLabel: string;
  reason: string;
  persona: PersonaSummary;
};

export type AdvicePlan = {
  items: AdvicePlanItem[];
};

export type AdviceRunCard = {
  id: string;
  slot: AdviceSlotId;
  persona: PersonaSummary;
};

export type AdviceRunEvent =
  | {
      type: "plan";
      runId: string;
      plan: AdvicePlan;
      cards: AdviceRunCard[];
    }
  | {
      type: "card.delta";
      runId: string;
      cardId: string;
      delta: string;
    }
  | {
      type: "card.done";
      runId: string;
      cardId: string;
    }
  | {
      type: "card.failed";
      runId: string;
      cardId: string;
      error: string;
    }
  | {
      type: "run.done";
      runId: string;
    };

export type StartAdviceRunInput = {
  question: string;
};

export type RetryAdviceCardInput = {
  question: string;
  cardId: string;
  slot: AdviceSlotId;
  personaId: string;
};

export const adviceSynthesisModes = ["decision", "communication"] as const;

export type AdviceSynthesisMode = (typeof adviceSynthesisModes)[number];

export type AdviceSynthesisCardInput = {
  personaName: string;
  perspectiveLabel: string;
  body: string;
};

export type AdviceSynthesisInput = {
  question: string;
  mode: AdviceSynthesisMode;
  cards: AdviceSynthesisCardInput[];
};

export type AdviceSynthesisResult = {
  title: string;
  body: string;
  source: "model" | "prototype";
};

export function encodeAdviceRunEvent(event: AdviceRunEvent) {
  return `${JSON.stringify(event)}\n`;
}
