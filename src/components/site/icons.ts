import {
  AudioWaveform, BookOpen, Box, Clapperboard, Crosshair, Footprints, Ghost, Puzzle, Swords, Code2, Cpu, Gamepad2, Gift, GitBranch, Globe, Plug, Smartphone, Users, Grid3x3, Image, MessagesSquare, Mic, Music, Sparkles, Wand2,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'game-maker': Gamepad2, 'art-2d': Image, 'art-3d': Box, texture: Grid3x3, animation: Clapperboard,
  code: Code2, voice: Mic, music: Music, sfx: AudioWaveform, npc: MessagesSquare,
};

export const LIST_ICON: Record<string, LucideIcon> = {
  'ai-game-makers': Gamepad2, '2d-game-makers': Sparkles, 'no-code-ai-game-makers': Wand2,
  'ai-game-art-generators': Image, 'ai-sprite-generators': Sparkles, 'ai-3d-model-generators': Box,
  'ai-texture-generators': Grid3x3, 'ai-animation-tools': Clapperboard, 'ai-coding-tools-for-game-dev': Code2,
  'ai-for-unity': Cpu, 'ai-for-godot': Cpu, 'ai-for-unreal': Cpu, 'ai-voice-generators-for-games': Mic,
  'ai-music-generators-for-games': Music, 'ai-sound-effect-generators': AudioWaveform, 'ai-npc-tools': MessagesSquare,
  'free-ai-game-dev-tools': Gift, 'ai-browser-game-makers': Globe, 'ai-mobile-game-makers': Smartphone,
  'ai-multiplayer-game-makers': Users, 'ai-for-roblox': Cpu, 'mcp-servers-for-game-dev': Plug, 'open-source-ai-game-dev-tools': GitBranch,
  'ai-platformer-makers': Footprints, 'ai-rpg-makers': Swords, 'ai-visual-novel-makers': BookOpen,
  'ai-puzzle-game-makers': Puzzle, 'ai-shooter-game-makers': Crosshair, 'ai-horror-game-makers': Ghost,
};
