jest.mock('../database/perceptions', () => ({
  // No PAQ ratings in these fixtures.
  getRatedPaq: () => null,
  getCircumplexQuadrantLabel: () => 'Vibrant',
  getIsoAxisLabel: (value: number, positive: string, negative: string) =>
    value >= 0 ? positive : negative,
  getIsoAxisPercent: (value: number) => Math.round(Math.abs(value) * 100),
}));

import { formatAsCSV } from './formatters';
import { RecordingWithPerception } from '../../types/recording';

describe('formatAsCSV', () => {
  it('includes optional participant metadata columns', () => {
    const recording: RecordingWithPerception = {
      id: 'rec-1',
      audioUri: 'file:///tmp/audio.wav',
      sampleRate: 48000,
      bitDepth: 16,
      durationMs: 15000,
      deviceModel: 'Phone',
      osVersion: '1',
      micRoute: 'built-in',
      recordedAt: '2026-03-07T10:00:00.000Z',
      timezone: 'Europe/Berlin',
      latitude: 49.79,
      longitude: 9.93,
      gpsAccuracy: 5,
      privacyMode: 'exact',
      communityVisibility: 'community',
      protocolType: 'opportunistic',
      hasClipping: false,
      hasWindHandling: false,
      hasLowSNR: false,
      syncStatus: 'local',
      createdAt: '2026-03-07T10:00:00.000Z',
      updatedAt: '2026-03-07T10:00:00.000Z',
    };

    const csv = formatAsCSV([recording], {
      ageRange: '25-34',
      gender: 'Female',
      occupation: 'Researcher',
      livingArea: 'Urban',
    });

    expect(csv).toContain('participant_age_range');
    expect(csv).toContain('participant_gender');
    expect(csv).toContain('25-34');
    expect(csv).toContain('Researcher');
  });
});
