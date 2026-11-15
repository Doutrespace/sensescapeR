import {
  MULTISENSORY_EXPORT_COLUMNS,
  compactMultisensory,
  countAnsweredItems,
  countAnsweredModules,
  parseMultisensory,
  serializeMultisensory,
  toMultisensoryExportRow,
} from './multisensory';

describe('multisensory assessment', () => {
  it('treats an untouched assessment as nothing to store', () => {
    expect(serializeMultisensory({})).toBeUndefined();
    expect(serializeMultisensory({ visual: {}, smell: { sources: [] } })).toBeUndefined();
    expect(compactMultisensory(null)).toBeNull();
  });

  it('keeps zero ratings, which are valid scale points', () => {
    const json = serializeMultisensory({ thermal: { sensation: 0, comfort: 0 } });
    expect(parseMultisensory(json)).toEqual({ thermal: { sensation: 0, comfort: 0 } });
  });

  it('counts only required items towards module progress', () => {
    const assessment = {
      smell: { pleasantness: 0.4, sources: ['food'] },
      emotion: { valence: 7, arousal: 3, dominance: 5 },
    };
    expect(countAnsweredItems(assessment, 'smell')).toBe(1);
    expect(countAnsweredItems(assessment, 'emotion')).toBe(2);
    expect(countAnsweredItems(assessment, 'visual')).toBe(0);
    expect(countAnsweredModules(assessment)).toBe(2);
  });

  it('returns null for malformed stored values', () => {
    expect(parseMultisensory('not json')).toBeNull();
    expect(parseMultisensory('[1,2]')).toBeNull();
    expect(parseMultisensory(undefined)).toBeNull();
  });

  it('flattens to a fixed set of export columns', () => {
    const row = toMultisensoryExportRow({
      visual: { coherence: 4 },
      smell: { pleasantness: -0.5, intensity: 0.8, sources: ['traffic', 'smoke'] },
      environment: { richInSpecies: 2 },
    });

    expect(Object.keys(row)).toEqual([...MULTISENSORY_EXPORT_COLUMNS]);
    expect(row.visual_coherence).toBe(4);
    expect(row.visual_mystery).toBeNull();
    expect(row.smell_sources).toBe('traffic|smoke');
    expect(row.psd_rich_in_species).toBe(2);
    expect(toMultisensoryExportRow(null).emotion_valence).toBeNull();
  });
});
