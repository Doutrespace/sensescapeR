const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockRunAsync = jest.fn();

jest.mock('./index', () => ({
  getDatabase: jest.fn(async () => ({
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
  })),
}));

import { getRecordingCount, getRecordings, getRecordingsWithPerceptions } from './recordings';

describe('recordings database service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies pagination when loading recordings', async () => {
    mockGetAllAsync.mockResolvedValueOnce([]);

    await getRecordings(undefined, { limit: 25, offset: 50 });

    expect(mockGetAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY recorded_at DESC LIMIT ? OFFSET ?'),
      [25, 50]
    );
  });

  it('applies filters to the recording query', async () => {
    mockGetAllAsync.mockResolvedValueOnce([]);

    await getRecordings({
      protocols: ['soundwalk'],
      habitats: ['forest'],
      syncStatus: ['uploaded'],
      hasQualityIssues: true,
    });

    const [query, params] = mockGetAllAsync.mock.calls[0];

    expect(query).toContain('protocol_type IN (?)');
    expect(query).toContain('habitat_type IN (?)');
    expect(query).toContain('sync_status IN (?)');
    expect(query).toContain('(has_clipping = 1 OR has_wind_handling = 1 OR has_low_snr = 1)');
    expect(params).toEqual(['soundwalk', 'forest', 'uploaded']);
  });

  it('maps joined recording and perception rows into typed results', async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      {
        id: 'rec-1',
        audio_uri: 'file:///tmp/audio.wav',
        sample_rate: 48000,
        bit_depth: 16,
        duration_ms: 1200,
        device_model: 'Phone',
        os_version: '1.0',
        mic_route: 'built-in',
        recorded_at: '2026-03-07T10:00:00.000Z',
        timezone: 'Europe/Berlin',
        latitude: 49.79,
        longitude: 9.95,
        gps_accuracy: 8,
        privacy_mode: 'exact',
        protocol_type: 'opportunistic',
        project_id: null,
        has_clipping: 0,
        has_wind_handling: 1,
        has_low_snr: 0,
        peak_db: -4.2,
        rms_db: -18.7,
        spectrogram_uri: 'file:///tmp/spectrogram.png',
        detected_sounds: '[{"label":"Speech","score":0.44}]',
        photo_uri: 'file:///tmp/photo.jpg',
        photo_classification: '[{"kind":"object","label":"Tree","score":0.61}]',
        field_notes: 'Notes',
        spoken_description: 'Transcript',
        habitat_type: 'forest',
        setting_chips: '{"outdoor":true}',
        source_dominance: '{"biophony":40}',
        license: 'CC-BY',
        community_visibility: 'private',
        sync_status: 'uploaded',
        remote_id: 'remote-1',
        created_at: '2026-03-07T10:00:00.000Z',
        updated_at: '2026-03-07T10:05:00.000Z',
        p_id: 'per-1',
        p_iso_pleasant: 0.45,
        p_iso_eventful: -0.12,
        p_paq_pleasant: null,
        p_paq_vibrant: null,
        p_paq_eventful: null,
        p_paq_chaotic: null,
        p_paq_annoying: null,
        p_paq_monotonous: null,
        p_paq_uneventful: null,
        p_paq_calm: null,
        p_created_at: '2026-03-07T10:06:00.000Z',
      },
    ]);

    const results = await getRecordingsWithPerceptions();

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'rec-1',
      photoClassification: [{ kind: 'object', label: 'Tree', score: 0.61 }],
      perception: {
        id: 'per-1',
        isoPleasant: 0.45,
        isoEventful: -0.12,
      },
    });
  });

  it('builds filtered count queries consistently', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ count: 4 });

    const count = await getRecordingCount({
      dateRange: {
        start: '2026-03-01T00:00:00.000Z',
        end: '2026-03-31T23:59:59.999Z',
      },
      syncStatus: ['local', 'failed'],
    });

    const [query, params] = mockGetFirstAsync.mock.calls[0];

    expect(count).toBe(4);
    expect(query).toContain('recorded_at >= ? AND recorded_at <= ?');
    expect(query).toContain('sync_status IN (?,?)');
    expect(params).toEqual([
      '2026-03-01T00:00:00.000Z',
      '2026-03-31T23:59:59.999Z',
      'local',
      'failed',
    ]);
  });
});
