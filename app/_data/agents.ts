export interface Agent {
  id: string;
  name: string;
  character: string;
  skills: string[];
  textureKey: string;
  role?: string;
  description?: string;
}

/** Texture keys loaded in PreloadScene (must match exactly). */
export const AGENT_TEXTURE_KEYS = ["npc-adam", "npc-alex", "npc-amelia", "npc-bob"] as const;
const DEFAULT_TEXTURE_KEY = "npc-alex";

/** Map API agent name to a loaded texture key; unknown names get default. */
function getTextureKeyForName(agentName: string): string {
  const normalized = agentName.trim().toLowerCase();
  if (normalized === "adam") return "npc-adam";
  if (normalized === "alex") return "npc-alex";
  if (normalized === "amelia") return "npc-amelia";
  if (normalized === "bob") return "npc-bob";
  return DEFAULT_TEXTURE_KEY;
}

/** Map API agents to app Agent shape. Returns [] when no API data (purely API-driven). */
export function mergeAgentsWithApi(
  apiAgents: Array<{
    id: number;
    agentName: string;
    description: string;
    skills: string[];
    role: string;
  }>,
): Agent[] {
  if (!apiAgents?.length) return [];
  return apiAgents.map((api) => ({
    id: `agent-${api.id}`,
    name: api.agentName,
    character: api.description ?? "",
    skills: api.skills ?? [],
    textureKey: getTextureKeyForName(api.agentName),
    role: api.role,
    description: api.description,
  }));
}
