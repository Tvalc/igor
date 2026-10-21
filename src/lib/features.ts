// Capability checklist per category. Tools get the features of every category they're in.
// Values live in each tool's YAML under `features`; a missing key means "not yet verified", never "no".

export const FEATURE_VALUES = ['yes', 'partial', 'no'] as const;
export type FeatureValue = (typeof FEATURE_VALUES)[number];

export interface FeatureDef {
  key: string;
  label: string;
}

export const FEATURES: Record<string, FeatureDef[]> = {
  'game-maker': [
    { key: 'no_code', label: 'Make a game without code' },
    { key: 'edit_code', label: 'View and edit the code' },
    { key: 'ai_art', label: 'Generates game art' },
    { key: 'ai_audio', label: 'Generates music or sound' },
    { key: 'multiplayer', label: 'Multiplayer games' },
    { key: 'mobile', label: 'Mobile export or play' },
    { key: 'hosting', label: 'One-click publish and share link' },
    { key: 'export_project', label: 'Download the project files' },
  ],
  'art-2d': [
    { key: 'pixel_art', label: 'Pixel art' },
    { key: 'sprite_sheets', label: 'Animated sprite sheets' },
    { key: 'consistent_characters', label: 'Consistent characters across images' },
    { key: 'custom_training', label: 'Train on your own style' },
    { key: 'tilesets', label: 'Tilesets' },
    { key: 'transparent_bg', label: 'Transparent backgrounds' },
    { key: 'multi_direction', label: '4- or 8-direction views' },
    { key: 'api', label: 'API' },
  ],
  'art-3d': [
    { key: 'text_to_3d', label: 'Text to 3D' },
    { key: 'image_to_3d', label: 'Image to 3D' },
    { key: 'pbr_textures', label: 'PBR textures on models' },
    { key: 'auto_rigging', label: 'Auto-rigging' },
    { key: 'low_poly', label: 'Low-poly or retopology' },
    { key: 'api', label: 'API' },
  ],
  texture: [
    { key: 'seamless', label: 'Seamless tiling' },
    { key: 'pbr_maps', label: 'PBR maps (normal, roughness…)' },
    { key: 'upscale', label: 'Upscaling' },
    { key: 'engine_plugin', label: 'Engine or DCC plugin' },
  ],
  animation: [
    { key: 'video_mocap', label: 'Video to motion capture' },
    { key: 'text_to_motion', label: 'Text to motion' },
    { key: 'multi_person', label: 'Multiple people at once' },
    { key: 'hands_face', label: 'Hand or face tracking' },
    { key: 'retarget', label: 'Retarget to your own rig' },
    { key: 'realtime', label: 'Real-time' },
  ],
  code: [
    { key: 'engine_integration', label: 'Works inside the game engine' },
    { key: 'mcp', label: 'MCP support' },
    { key: 'scene_editing', label: 'Edits scenes and assets, not just code' },
    { key: 'runs_game', label: 'Runs or playtests the game' },
    { key: 'model_choice', label: 'Choose the AI model' },
    { key: 'local_models', label: 'Local or offline models' },
  ],
  voice: [
    { key: 'cloning', label: 'Voice cloning' },
    { key: 'voice_design', label: 'Design a voice from a description' },
    { key: 'emotion_control', label: 'Emotion and delivery control' },
    { key: 'multilingual', label: 'Multiple languages' },
    { key: 'speech_to_speech', label: 'Speech to speech' },
    { key: 'api', label: 'API' },
  ],
  music: [
    { key: 'stems', label: 'Separate stems' },
    { key: 'loops', label: 'Seamless loops' },
    { key: 'vocals', label: 'Vocals' },
    { key: 'custom_length', label: 'Set track length' },
    { key: 'api', label: 'API' },
  ],
  sfx: [
    { key: 'text_to_sfx', label: 'Text to sound effect' },
    { key: 'variations', label: 'Multiple variations' },
    { key: 'loopable', label: 'Loopable sounds' },
    { key: 'api', label: 'API' },
  ],
  npc: [
    { key: 'unity_sdk', label: 'Unity SDK' },
    { key: 'unreal_sdk', label: 'Unreal SDK' },
    { key: 'voice', label: 'Built-in voice' },
    { key: 'memory', label: 'Long-term memory' },
    { key: 'actions', label: 'NPCs trigger game actions' },
    { key: 'on_device', label: 'Runs on device' },
  ],
};

/** Feature definitions for a set of categories, deduplicated by key in category order. */
export function featuresFor(categories: readonly string[]): FeatureDef[] {
  const seen = new Set<string>();
  return categories.flatMap((c) => FEATURES[c] ?? []).filter((f) => !seen.has(f.key) && seen.add(f.key));
}

export const ALL_FEATURE_KEYS = new Set(Object.values(FEATURES).flat().map((f) => f.key));
