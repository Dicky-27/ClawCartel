export interface Agent {
  id: string;
  name: string;
  character: string;
  skills: string[];
  textureKey: string;
}

export const AGENTS: Agent[] = [
  {
    id: "adam",
    name: "Adam",
    character: "Calm strategist. Thinks in systems and long-term outcomes. Speaks in short, precise sentences.",
    skills: ["Strategy", "Systems design", "Risk assessment", "Decision frameworks"],
    textureKey: "npc-adam",
  },
  {
    id: "alex",
    name: "Alex",
    character: "Bold and experimental. Loves new ideas and quick prototypes. Asks a lot of “what if?” questions.",
    skills: ["Prototyping", "Ideation", "Experimentation", "Creative problem-solving"],
    textureKey: "npc-alex",
  },
  {
    id: "amelia",
    name: "Amelia",
    character: "Detail-oriented and methodical. Cares about clarity, docs, and making sure nothing slips.",
    skills: ["Documentation", "QA", "Process design", "Clarity & structure"],
    textureKey: "npc-amelia",
  },
  {
    id: "bob",
    name: "BOB",
    character: "Pragmatic builder. Focuses on shipping, trade-offs, and what works in production.",
    skills: ["Shipping", "Trade-offs", "Production readiness", "Debugging"],
    textureKey: "npc-bob",
  },
];

const byId = new Map(AGENTS.map((a) => [a.id, a]));
const byName = new Map(AGENTS.map((a) => [a.name, a]));
const byTextureKey = new Map(AGENTS.map((a) => [a.textureKey, a]));

export function getAgentById(id: string): Agent | undefined {
  return byId.get(id);
}

export function getAgentByName(name: string): Agent | undefined {
  // Normalize display name to match agent (e.g. "Bob" -> BOB)
  const normalized = name.replace(/\s*NPC\s*$/i, "").trim();
  return byName.get(normalized) ?? byId.get(normalized.toLowerCase());
}

export function getAgentByTextureKey(key: string): Agent | undefined {
  return byTextureKey.get(key);
}
