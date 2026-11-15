import { appendPromptSeed, extractNoteThemes } from './noteAnalysis';

describe('note analysis', () => {
  it('extracts bilingual note themes from notes and transcript', () => {
    const themes = extractNoteThemes(
      'Light traffic, birds in the trees, overall calm.',
      'Ein paar Stimmen und Verkehr im Hintergrund.'
    );

    expect(themes.map((theme) => theme.key)).toEqual(
      expect.arrayContaining(['traffic', 'birds', 'quiet', 'voices'])
    );
  });

  it('appends guided prompt seeds once', () => {
    const seeded = appendPromptSeed('', 'Dominant sounds:');
    const duplicated = appendPromptSeed(seeded, 'Dominant sounds:');

    expect(seeded).toBe('Dominant sounds: ');
    expect(duplicated).toBe('Dominant sounds: ');
  });
});
