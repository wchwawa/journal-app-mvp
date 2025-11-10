export interface VoiceProfile {
  id: string;
  label: string;
  description: string;
  voice: string;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'calm-male',
    label: 'Calm & Steady (Male)',
    description: 'Grounded baritone with slow, reassuring pacing.',
    voice: 'alloy'
  },
  {
    id: 'calm-female',
    label: 'Calm & Steady (Female)',
    description: 'Measured mezzo voice that stays composed under pressure.',
    voice: 'verse'
  },
  {
    id: 'tender-male',
    label: 'Tender & Warm (Male)',
    description: 'Soft tenor that leans into empathy and gentle encouragement.',
    voice: 'sage'
  },
  {
    id: 'tender-female',
    label: 'Tender & Warm (Female)',
    description: 'Light, soothing tone ideal for reflective guidance.',
    voice: 'lily'
  },
  {
    id: 'lively-male',
    label: 'Lively & Curious (Male)',
    description: 'Playful energy with quick cadence for upbeat chats.',
    voice: 'adam'
  },
  {
    id: 'lively-female',
    label: 'Lively & Curious (Female)',
    description: 'Bright and optimistic, great for pep talks.',
    voice: 'aria'
  },
  {
    id: 'holiday-santa',
    label: 'Festive (Santa)',
    description: 'Seasonal, joyful presence with a cozy chuckle.',
    voice: 'ember'
  }
];

export const DEFAULT_VOICE_ID = VOICE_PROFILES[0].id;

export const findVoiceById = (id?: string) =>
  VOICE_PROFILES.find((profile) => profile.id === id) ?? VOICE_PROFILES[0];
