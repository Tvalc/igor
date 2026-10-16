import { getCollection } from 'astro:content';
import { rank, scoreTool, groupOf, type Group, type Scored, type Tool } from './score';

export interface ListDef {
  slug: string;
  title: string; // also the H1
  query: string; // the search phrase this page answers
  question: string; // lead FAQ question, phrased the way people ask it
  group: Group | 'mixed'; // 'mixed' lists score each tool with its own category's rubric
  blurb: string;
  filter: (t: Tool) => boolean;
}

const has = (t: Tool, c: string) => (t.data.categories as string[]).includes(c);
const tag = (t: Tool, x: string) => t.data.tags.includes(x);
const engine = (t: Tool, e: string) => (t.data.engines as string[]).includes(e);

export const LISTS: ListDef[] = [
  {
    slug: 'ai-game-makers', title: 'Best AI Game Makers', question: 'What is the best AI game maker?',
    query: 'make a game with AI', group: 'maker',
    blurb: 'Platforms that turn a description into a playable game, from no-code prompt-to-game tools to AI-first engines.',
    filter: (t) => has(t, 'game-maker'),
  },
  {
    slug: '2d-game-makers', title: 'Best AI Tools to Make 2D Games', question: 'What is the best AI tool to make a 2D game?',
    query: 'make 2D games with AI', group: 'maker',
    blurb: 'AI game makers that handle 2D games well, including tools that generate the sprites too.',
    filter: (t) => has(t, 'game-maker') && tag(t, '2d'),
  },
  {
    slug: 'no-code-ai-game-makers', title: 'Best No-Code AI Game Makers', question: 'What is the best way to make a game with AI without coding?',
    query: 'make a game with AI without coding', group: 'maker',
    blurb: 'AI game makers you can use without writing a line of code.',
    filter: (t) => has(t, 'game-maker') && t.data.skill_level === 'beginner',
  },
  {
    slug: 'ai-game-art-generators', title: 'Best AI Game Art Generators', question: 'What is the best AI tool to make game art?',
    query: 'make game art with AI', group: 'art',
    blurb: 'Tools for concept art, sprites, characters and in-game 2D art.',
    filter: (t) => has(t, 'art-2d'),
  },
  {
    slug: 'ai-sprite-generators', title: 'Best AI Sprite & Pixel Art Generators', question: 'What is the best AI sprite generator?',
    query: 'AI sprite generator', group: 'art',
    blurb: 'Game-aware sprite tools: pixel art, sprite sheets, multi-direction characters and tilesets.',
    filter: (t) => has(t, 'art-2d') && (tag(t, 'sprites') || tag(t, 'pixel-art')),
  },
  {
    slug: 'ai-3d-model-generators', title: 'Best AI 3D Model Generators for Games', question: 'What is the best AI 3D model generator for games?',
    query: 'AI 3D model generator for games', group: 'art',
    blurb: 'Text- and image-to-3D tools, judged on game-ready exports, rigging and licensing.',
    filter: (t) => has(t, 'art-3d') && !has(t, 'code'),
  },
  {
    slug: 'ai-texture-generators', title: 'Best AI Texture & PBR Material Generators', question: 'What is the best AI texture generator for games?',
    query: 'AI texture generator for games', group: 'art',
    blurb: 'Tools that generate textures and tileable PBR materials.',
    filter: (t) => has(t, 'texture'),
  },
  {
    slug: 'ai-animation-tools', title: 'Best AI Animation & Mocap Tools for Games', question: 'What is the best AI animation tool for games?',
    query: 'AI animation for games', group: 'art',
    blurb: 'Video-to-mocap, text-to-motion, AI-assisted keyframing and sprite animation.',
    filter: (t) => has(t, 'animation'),
  },
  {
    slug: 'ai-coding-tools-for-game-dev', title: 'Best AI Coding Tools for Game Development', question: 'What is the best AI coding tool for game development?',
    query: 'AI coding assistant for game development', group: 'code',
    blurb: 'Coding agents, editor assistants and MCP servers that write and edit game code.',
    filter: (t) => has(t, 'code'),
  },
  {
    slug: 'ai-for-unity', title: 'Best AI Tools for Unity', question: 'What is the best AI tool for Unity?',
    query: 'AI for Unity', group: 'mixed',
    blurb: 'AI that works inside or alongside the Unity Editor.',
    filter: (t) => engine(t, 'unity'),
  },
  {
    slug: 'ai-for-godot', title: 'Best AI Tools for Godot', question: 'What is the best AI tool for Godot?',
    query: 'AI for Godot', group: 'mixed',
    blurb: 'AI assistants, agents and MCP servers for the Godot engine.',
    filter: (t) => engine(t, 'godot'),
  },
  {
    slug: 'ai-for-unreal', title: 'Best AI Tools for Unreal Engine', question: 'What is the best AI tool for Unreal Engine?',
    query: 'AI for Unreal Engine', group: 'mixed',
    blurb: 'AI agents, plugins and MCP servers for Unreal Engine.',
    filter: (t) => engine(t, 'unreal'),
  },
  {
    slug: 'ai-voice-generators-for-games', title: 'Best AI Voice Generators for Games', question: 'What is the best AI voice generator for games?',
    query: 'AI voice generator for games', group: 'audio',
    blurb: 'Text to speech and voice design for characters and dialogue.',
    filter: (t) => has(t, 'voice'),
  },
  {
    slug: 'ai-music-generators-for-games', title: 'Best AI Music Generators for Games', question: 'What is the best AI music generator for games?',
    query: 'AI music for games', group: 'audio',
    blurb: 'Soundtracks, loops and background music, judged on commercial rights.',
    filter: (t) => has(t, 'music'),
  },
  {
    slug: 'ai-sound-effect-generators', title: 'Best AI Sound Effect Generators', question: 'What is the best AI sound effect generator?',
    query: 'AI sound effects for games', group: 'audio',
    blurb: 'Text-to-SFX and sound design tools.',
    filter: (t) => has(t, 'sfx'),
  },
  {
    slug: 'ai-npc-tools', title: 'Best AI NPC & Character Dialogue Tools', question: 'What is the best AI NPC tool?',
    query: 'AI NPC dialogue', group: 'audio',
    blurb: 'Runtimes and platforms for conversational, voiced game characters.',
    filter: (t) => has(t, 'npc'),
  },
  {
    slug: 'free-ai-game-dev-tools', title: 'Best Free AI Game Development Tools', question: 'What are the best free AI tools for game development?',
    query: 'free AI tools for game development', group: 'mixed',
    blurb: 'Every tool with a genuinely free tier or open-source license, across all categories.',
    filter: (t) => t.data.pricing.free_tier === 'yes',
  },
];

export const MIN_LIST_SIZE = 3;

// Icon names from src/components/Icon.astro.
export const LIST_ICONS: Record<string, string> = {
  'ai-game-makers': 'gamepad', '2d-game-makers': 'pixel', 'no-code-ai-game-makers': 'wand',
  'ai-game-art-generators': 'image', 'ai-sprite-generators': 'pixel', 'ai-3d-model-generators': 'cube',
  'ai-texture-generators': 'grid', 'ai-animation-tools': 'motion', 'ai-coding-tools-for-game-dev': 'code',
  'ai-for-unity': 'engine', 'ai-for-godot': 'engine', 'ai-for-unreal': 'engine',
  'ai-voice-generators-for-games': 'mic', 'ai-music-generators-for-games': 'music',
  'ai-sound-effect-generators': 'wave', 'ai-npc-tools': 'chat', 'free-ai-game-dev-tools': 'gift',
};

export async function activeTools() {
  return (await getCollection('tools')).sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export async function rankedList(def: ListDef): Promise<Scored[]> {
  const tools = await activeTools();
  const matching = tools.filter(def.filter);
  if (def.group === 'mixed') {
    return matching
      .filter((t) => t.data.status !== 'discontinued')
      .map((t) => scoreTool(t))
      .sort((a, b) => b.score - a.score || a.tool.data.name.localeCompare(b.tool.data.name));
  }
  return rank(matching, def.group);
}

let listsCache: Promise<{ def: ListDef; ranked: Scored[] }[]> | undefined;
export function publishedLists() {
  return (listsCache ??= computeLists());
}

async function computeLists() {
  const out: { def: ListDef; ranked: Scored[] }[] = [];
  for (const def of LISTS) {
    const ranked = await rankedList(def);
    if (ranked.length >= MIN_LIST_SIZE) out.push({ def, ranked });
  }
  return out;
}

/** Curated comparison pairs: every pair among the top 5 of each published list. */
let pairsCache: ReturnType<typeof computePairs> | undefined;
export function comparisonPairs() {
  return (pairsCache ??= computePairs());
}

async function computePairs() {
  const pairs = new Map<string, { a: Tool; b: Tool; group: Group; list: ListDef }>();
  for (const { def, ranked } of await publishedLists()) {
    if (def.group === 'mixed') continue;
    const top = ranked.slice(0, 5).map((s) => s.tool);
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const [a, b] = [top[i], top[j]].sort((x, y) => x.id.localeCompare(y.id));
        const slug = `${a.id}-vs-${b.id}`;
        if (!pairs.has(slug)) pairs.set(slug, { a, b, group: def.group as Group, list: def });
      }
    }
  }
  return pairs;
}

export async function alternativesFor(tool: Tool, n = 6): Promise<Scored[]> {
  const group = groupOf(tool);
  const primary = tool.data.categories[0];
  const tools = await activeTools();
  return rank(
    tools.filter((t) => t.id !== tool.id && (t.data.categories as string[]).includes(primary)),
    group,
  ).slice(0, n);
}

let altCache: Promise<Set<string>> | undefined;
/** Slugs whose /alternatives page is published (needs at least 3 real alternatives). */
export function toolsWithAlternatives() {
  return (altCache ??= (async () => {
    const out = new Set<string>();
    for (const t of await activeTools()) if ((await alternativesFor(t, 3)).length >= 3) out.add(t.id);
    return out;
  })());
}

export async function listsContaining(tool: Tool) {
  return (await publishedLists()).filter(({ ranked }) => ranked.some((s) => s.tool.id === tool.id));
}
