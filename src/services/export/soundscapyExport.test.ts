import { formatAsSoundscapyCSV } from './soundscapyExport';
import { RecordingWithPerception } from '../../types/recording';

describe('formatAsSoundscapyCSV', () => {
  it('exports rated PAQ and ISO columns with Soundscapy-oriented headers', () => {
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
      peakDb: -8,
      rmsDb: -22,
      habitatType: 'urban_park',
      sourceDominance: JSON.stringify({
        biophony: 20,
        geophony: 15,
        anthrophony: 65,
      }),
      syncStatus: 'local',
      createdAt: '2026-03-07T10:00:00.000Z',
      updatedAt: '2026-03-07T10:00:00.000Z',
      fieldNotes: 'Busy intersection next to a park.',
      spokenDescription: 'Cars passing and some birds in the background.',
      photoClassification: [
        { label: 'car', confidence: 0.8, category: 'traffic', emoji: 'x', source: 'object' },
        { label: 'tree', confidence: 0.6, coverage: 0.32, category: 'nature', emoji: 'x', source: 'environment' },
      ],
      perception: {
        id: 'perc-1',
        recordingId: 'rec-1',
        isoPleasant: -0.2,
        isoEventful: 0.6,
        paqPleasant: 2,
        paqVibrant: 4,
        paqEventful: 4,
        paqChaotic: 3,
        paqAnnoying: 4,
        paqMonotonous: 2,
        paqUneventful: 1,
        paqCalm: 2,
        createdAt: '2026-03-07T10:00:00.000Z',
      },
    };

    const csv = formatAsSoundscapyCSV([recording], {
      ageRange: '25-34',
      gender: 'Female',
      occupation: 'Researcher',
      livingArea: 'Urban',
    });

    expect(csv).toContain('RecordID,GroupID,SessionID,LocationID,Timestamp');
    expect(csv).toContain('ISOPleasant');
    expect(csv).toContain('ParticipantAgeRange');
    expect(csv).toContain('LAeqApproxDbfs');
    expect(csv).toContain('Busy intersection next to a park.');
    expect(csv).toContain('car');
    expect(csv).toContain('tree 32%');
    expect(csv).toContain('Researcher');
  });
});
