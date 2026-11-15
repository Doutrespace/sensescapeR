import {
  buildRankedClassifications,
  buildMacroClassifications,
  getDisplayLabel,
  getMacroFamily,
  selectBroadDisplayClassifications,
  selectDetailedDisplayClassifications,
} from './audioClassification';

describe('audioClassification', () => {
  it('preserves raw model scores without penalty reweighting', () => {
    const labels = ['Speech', 'Vehicle'];
    const scores = new Float32Array([0.34, 0.18]);

    const ranked = buildRankedClassifications(scores, labels);

    expect(ranked[0].adjustedScore).toBeCloseTo(0.34, 5);
    expect(ranked[1].adjustedScore).toBeCloseTo(0.18, 5);
  });

  it('keeps broad superclass labels out of the specific list so concrete classes lead it', () => {
    const labels = [
      'Speech',
      'Domestic sounds, home sounds',
      'Piano',
    ];
    const scores = new Float32Array([0.28, 0.35, 0.18]);

    const ranked = buildRankedClassifications(scores, labels);
    const detailed = selectDetailedDisplayClassifications(ranked);

    expect(detailed[0].label).toBe('Piano');
    expect(detailed[0].adjustedScore).toBeCloseTo(0.18, 5);
  });

  it('keeps bird labels detailed instead of collapsing them into nature', () => {
    const labels = ['Bird', 'Bird vocalization, bird call, bird song', 'Wind'];
    const scores = new Float32Array([0.27, 0.33, 0.19]);

    const ranked = buildRankedClassifications(scores, labels);
    const detailed = selectDetailedDisplayClassifications(ranked);

    expect(detailed[0].label).toBe('Bird vocalization, bird call, bird song');
  });

  it('keeps whistling available as a detailed class without forcing it to the top', () => {
    const labels = ['Whistling', 'Pink noise'];
    const scores = new Float32Array([0.22, 0.30]);

    const ranked = buildRankedClassifications(scores, labels);
    const detailed = selectDetailedDisplayClassifications(ranked);

    expect(detailed.map((entry) => entry.label)).toContain('Whistling');
  });

  it('surfaces broad superclass labels through the broad hierarchy selector', () => {
    const labels = ['Speech', 'Animal'];
    const scores = new Float32Array([0.31, 0.22]);

    const ranked = buildRankedClassifications(scores, labels);
    const broad = selectBroadDisplayClassifications(ranked);

    expect(broad[0].label).toBe('Speech');
  });

  it('drops weak runner-up classes that are far below the top specific score', () => {
    const labels = ['Speech', 'Bird vocalization, bird call, bird song', 'Rain'];
    const scores = new Float32Array([0.42, 0.13, 0.1]);

    const ranked = buildRankedClassifications(scores, labels);
    const detailed = selectDetailedDisplayClassifications(ranked, 0.1);

    expect(detailed.map((entry) => entry.label)).toEqual(['Bird vocalization, bird call, bird song']);
  });

  it('keeps broad hierarchy labels out of the specific list', () => {
    const labels = ['Speech', 'Conversation', 'Walk, footsteps'];
    const scores = new Float32Array([0.34, 0.28, 0.19]);

    const ranked = buildRankedClassifications(scores, labels);
    const detailed = selectDetailedDisplayClassifications(ranked, 0.1);

    expect(detailed.map((entry) => entry.label)).toEqual(['Conversation', 'Walk, footsteps']);
  });

  it('surfaces broad hierarchy labels in the broad list', () => {
    const labels = ['Animal', 'Speech', 'Conversation', 'Bird'];
    const scores = new Float32Array([0.34, 0.27, 0.22, 0.18]);

    const ranked = buildRankedClassifications(scores, labels);
    const broad = selectBroadDisplayClassifications(ranked, 0.1);

    expect(broad.map((entry) => entry.label)).toEqual(['Animal', 'Speech', 'Bird']);
  });

  it('builds anthrophony, biophony, and geophony macro groups', () => {
    const labels = [
      'Speech',
      'Bird vocalization, bird call, bird song',
      'Rain',
      'Engine',
    ];
    const scores = new Float32Array([0.31, 0.28, 0.24, 0.19]);

    const ranked = buildRankedClassifications(scores, labels);
    const macros = buildMacroClassifications(ranked);

    expect(macros.map((entry) => entry.label)).toEqual([
      'Anthrophony',
      'Biophony',
      'Geophony',
    ]);
  });

  it('cleans up long YAMNet labels for display while preserving family', () => {
    expect(getDisplayLabel('Bird vocalization, bird call, bird song')).toBe('Bird song / call');
    expect(getMacroFamily('Bird vocalization, bird call, bird song')).toBe('Biophony');
  });
});
