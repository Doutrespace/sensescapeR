jest.mock('../database/index', () => ({ getDatabase: jest.fn() }));

import { formatAsCSV, formatAsGeoJSON, formatAsJSON } from './formatters';
import { STUDY_COLUMNS } from './studyExport';
import { RecordingWithPerception } from '../../types/recording';

const recording: RecordingWithPerception = {
  id: '11111111-2222-4333-8444-555555555555',
  audioUri: 'file:///tmp/audio.wav',
  sampleRate: 48000,
  bitDepth: 16,
  durationMs: 30000,
  deviceModel: 'Phone',
  osVersion: '1',
  micRoute: 'built-in',
  recordedAt: '2026-11-24T10:00:00.000Z',
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
  createdAt: '2026-11-24T10:01:00.000Z',
  updatedAt: '2026-11-24T10:01:00.000Z',
};

const participant = {
  participantId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  personAnswers: { birth_year: 2000, gender: 'female', years_in_wuerzburg: 3 },
};

describe('export formats', () => {
  it('writes the study table as CSV with one header line per file', () => {
    const csv = formatAsCSV([recording], participant);
    const lines = csv.replace(/^﻿/, '').trimEnd().split('\r\n');

    expect(lines).toHaveLength(2);
    expect(lines[0].split(',')).toEqual(STUDY_COLUMNS);
    expect(lines[1].startsWith(`${recording.id},`)).toBe(true);
  });

  it('carries the study variables in JSON and GeoJSON', () => {
    const json = JSON.parse(formatAsJSON([recording], {}, participant));
    expect(json.count).toBe(1);
    expect(json.recordings[0].study.participant_id).toBe(participant.participantId);
    expect(json.recordings[0].study.gender).toBe('female');

    const geo = JSON.parse(formatAsGeoJSON([recording], participant));
    expect(geo.features[0].geometry).toEqual({ type: 'Point', coordinates: [9.93, 49.79] });
    expect(geo.features[0].properties.run_id).toBe(recording.id);
    expect(geo.features[0].properties.age).toBe(26);
  });
});
