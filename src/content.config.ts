import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { FEATURE_VALUES, featuresFor } from './lib/features';

// Every fact on the site comes from these schemas. Automation agents edit the YAML files;
// anything that doesn't validate fails the build.

export const CATEGORIES = [
  'game-maker', // prompt-to-game platforms and AI-first engines
  'art-2d', // sprites, pixel art, concept art, tilesets
  'art-3d', // text/image to 3D models
  'texture', // PBR materials and textures
  'animation', // motion capture, rigging, sprite animation
  'code', // coding assistants, engine agents, MCP servers
  'voice', // text to speech, voice design
  'music',
  'sfx',
  'npc', // conversational characters and NPC runtimes
] as const;

export const ENGINES = ['unity', 'unreal', 'godot', 'roblox', 'blender', 'aseprite', 'web'] as const;

export const EXPORTS = [
  'web', 'windows', 'mac', 'linux', 'ios', 'android', 'steam',
  'png', 'webp', 'sprite-sheet', 'gif', 'glb', 'fbx', 'obj', 'usdz', 'pbr-maps', 'bvh',
  'mp3', 'wav', 'source-code',
] as const;

const tools = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/tools' }),
  schema: z.object({
    name: z.string(),
    url: z.string().url(),
    tagline: z.string().max(120),
    description: z.string(),
    best_for: z.string(),
    categories: z.array(z.enum(CATEGORIES)).min(1),
    tags: z.array(z.string()).default([]),
    status: z.enum(['active', 'beta', 'research', 'discontinued']).default('active'),
    successor: z.string().optional(), // slug of the tool that replaced a discontinued one
    platforms: z.array(z.enum(['web', 'desktop', 'plugin', 'api', 'cli', 'self-hosted'])).default([]),
    engines: z.array(z.enum(ENGINES)).default([]),
    // Empty means "not yet verified", never "none".
    exports: z.array(z.enum(EXPORTS)).default([]),
    skill_level: z.enum(['beginner', 'intermediate', 'advanced']),
    pricing: z.object({
      model: z.enum(['free', 'freemium', 'trial', 'paid', 'one-time', 'open-source', 'bundled']),
      free_tier: z.enum(['yes', 'limited', 'trial', 'no', 'unknown']),
      starting_price_usd: z.number().nullable().default(null),
      notes: z.string().optional(),
    }),
    license: z.object({
      commercial_use: z.enum(['yes', 'paid-plans', 'restricted', 'no', 'unknown']).default('unknown'),
      open_source: z.boolean().default(false),
      notes: z.string().optional(),
    }),
    // Capability checklist (src/lib/features.ts). A missing key means "not yet verified".
    features: z.record(z.string(), z.enum(FEATURE_VALUES)).default({}),
    feature_notes: z.record(z.string(), z.string()).default({}),
    plans: z
      .array(
        z.object({
          name: z.string(),
          price_usd: z.number().nullable(), // monthly; 0 for free, null for custom pricing
          period: z.enum(['free', 'month', 'year', 'one-time', 'usage', 'custom']),
          includes: z.string().max(120).optional(),
        }),
      )
      .default([]),
    affiliate: z
      .object({
        url: z.string().url().optional(), // filled in once the program is joined
        program: z.string(),
        commission: z.string().optional(),
      })
      .optional(),
    sponsored: z.boolean().default(false),
    makko_owned: z.boolean().default(false),
    // Set only after a published hands-on test. Never estimated.
    hands_on: z
      .object({
        score: z.number().min(0).max(10),
        test: z.string(),
        date: z.coerce.date(),
      })
      .optional(),
    sources: z.array(z.string().url()).default([]),
    needs_verification: z.array(z.string()).default([]),
    last_verified: z.coerce.date(),
  }).superRefine((t, ctx) => {
    const allowed = new Set(featuresFor(t.categories).map((f) => f.key));
    for (const k of Object.keys(t.features)) {
      if (!allowed.has(k)) ctx.addIssue({ code: 'custom', path: ['features', k], message: `"${k}" is not a feature of this tool's categories` });
    }
  }),
});

const tests = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/tests' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    prompt: z.string(),
    tools: z.array(z.string()),
    status: z.enum(['planned', 'running', 'published']),
    date: z.coerce.date(),
  }),
});

export const collections = { tools, tests };
