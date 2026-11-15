export interface NotePrompt {
  id: string;
  label: string;
  seed: string;
}

export interface NoteTheme {
  key: string;
  label: string;
  matches: string[];
}

export const NOTE_PROMPTS: NotePrompt[] = [
  {
    id: 'sound_sources',
    label: 'What stood out acoustically?',
    seed: 'Dominant sounds:',
  },
  {
    id: 'visual_context',
    label: 'What stood out visually?',
    seed: 'Visual context:',
  },
  {
    id: 'intermittency',
    label: 'Anything unusual or intermittent?',
    seed: 'Intermittent events:',
  },
  {
    id: 'overall_feel',
    label: 'How did the place feel?',
    seed: 'Overall impression:',
  },
];

const THEME_DICTIONARY: Array<{ key: string; label: string; keywords: string[] }> = [
  { key: 'traffic', label: 'Traffic', keywords: ['traffic', 'car', 'cars', 'road', 'street', 'vehicle', 'vehicles', 'bus', 'truck', 'verkehr', 'autos'] },
  { key: 'voices', label: 'Voices', keywords: ['voice', 'voices', 'speech', 'conversation', 'talking', 'people talking', 'crowd', 'stimmen', 'gespräch', 'reden'] },
  { key: 'birds', label: 'Birds', keywords: ['bird', 'birds', 'birdsong', 'birds singing', 'vogel', 'vögel', 'vogelsang'] },
  { key: 'wind', label: 'Wind', keywords: ['wind', 'breeze', 'gust', 'windy', 'windgeräusch'] },
  { key: 'water', label: 'Water', keywords: ['water', 'river', 'fountain', 'stream', 'rain', 'regen', 'wasser', 'brunnen'] },
  { key: 'construction', label: 'Construction', keywords: ['construction', 'drill', 'hammer', 'building work', 'baustelle', 'bohren', 'hämmern'] },
  { key: 'quiet', label: 'Quiet', keywords: ['quiet', 'calm', 'peaceful', 'still', 'silent', 'ruhig', 'still', 'leise'] },
  { key: 'nature', label: 'Nature', keywords: ['trees', 'forest', 'park', 'green', 'leaves', 'natur', 'bäume', 'park'] },
  { key: 'echo', label: 'Echo', keywords: ['echo', 'reverb', 'reverberant', 'hall', 'hallig'] },
];

export function extractNoteThemes(fieldNotes?: string, spokenDescription?: string): NoteTheme[] {
  const text = [fieldNotes, spokenDescription]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!text.trim()) {
    return [];
  }

  return THEME_DICTIONARY.flatMap((theme) => {
    const matches = theme.keywords.filter((keyword) => text.includes(keyword));
    if (matches.length === 0) {
      return [];
    }

    return [{
      key: theme.key,
      label: theme.label,
      matches,
    }];
  });
}

export function appendPromptSeed(existingText: string, seed: string): string {
  const trimmed = existingText.trim();
  if (!trimmed) {
    return `${seed} `;
  }

  if (trimmed.includes(seed)) {
    return existingText;
  }

  return `${existingText.trimEnd()}\n${seed} `;
}
