jest.mock('../database/index', () => ({ getDatabase: jest.fn() }));

import {
  CSV_BOM,
  STUDY_COLUMNS,
  buildStudyRow,
  formatAsStudyCSV,
  formatCodebookCSV,
  toCsvCell,
  toLocalTimestamp,
} from './studyExport';
import { RUN_DATA_SCHEMA, serializeRunStudyData, type RunStudyData } from '../../study/runData';
import { RecordingWithPerception } from '../../types/recording';

const COLLECTOR = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const INTERVIEWEE = '99999999-8888-4777-8666-555555555555';

function study(overrides: Partial<RunStudyData> = {}): RunStudyData {
  return {
    schema: RUN_DATA_SCHEMA,
    collectorId: COLLECTOR,
    respondent: 'self',
    respondentId: COLLECTOR,
    person: { birth_year: 1998, gender: 'male', years_in_wuerzburg__na: true },
    consentVersion: '2026-11-24',
    consentAt: '2026-11-01T08:00:00.000Z',
    visitMode: 'staying',
    siteCode: 'M1',
    groupId: null,
    groupAnswers: {},
    runNumber: 3,
    questionnaireVersion: '2026-11-24',
    appVersion: '1.1.0',
    appLanguage: 'de',
    platform: 'web',
    userAgent: 'TestBrowser/1.0',
    savedAt: '2026-11-24T13:10:00.000Z',
    capture: { echoCancellation: false, noiseSuppression: true, autoGainControl: false, microphoneLabel: 'Built-in' },
    ...overrides,
  };
}

function recording(overrides: Partial<RecordingWithPerception> = {}): RecordingWithPerception {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    audioUri: 'file:///tmp/audio.wav',
    sampleRate: 48000,
    bitDepth: 16,
    durationMs: 30000,
    deviceModel: 'Phone',
    osVersion: 'iOS 19',
    micRoute: 'builtin',
    recordedAt: '2026-11-24T13:05:09.000Z',
    timezone: 'Europe/Berlin',
    latitude: 49.7913,
    longitude: 9.9534,
    gpsAccuracy: 8,
    privacyMode: 'exact',
    communityVisibility: 'private',
    protocolType: 'opportunistic',
    hasClipping: false,
    hasWindHandling: true,
    hasLowSNR: false,
    syncStatus: 'local',
    createdAt: '2026-11-24T13:10:00.000Z',
    updatedAt: '2026-11-24T13:10:00.000Z',
    participantId: COLLECTOR,
    settingChips: JSON.stringify({ indoor: false, outdoor: true, alone: false, inGroup: true }),
    perception: {
      id: 'p1',
      recordingId: '11111111-2222-4333-8444-555555555555',
      isoPleasant: 0.5,
      isoEventful: -0.25,
      createdAt: '2026-11-24T13:10:00.000Z',
    },
    studyData: serializeRunStudyData(study()),
    ...overrides,
  };
}

describe('study table rows', () => {
  it('identifies the measurement, the participant and the visit', () => {
    const row = buildStudyRow(recording());

    expect(row).toMatchObject({
      run_id: '11111111-2222-4333-8444-555555555555',
      run_number: 3,
      participant_id: COLLECTOR,
      participant_code: 'P-AAAAAA',
      respondent: 'self',
      collector_id: COLLECTOR,
      site_code: 'M1',
      visit_mode: 'staying',
      recorded_at: '2026-11-24T13:05:09.000Z',
      recorded_at_local: '2026-11-24 14:05:09',
      birth_year: 1998,
      age: 28,
      gender: 'male',
      years_in_wuerzburg: null,
      lives_in_wuerzburg: 0,
      setting_location: 'outdoor',
      setting_social: 'with_others',
      iso_pleasant: 0.5,
      iso_quadrant: 'Calm',
      has_wind_noise: 1,
      has_clipping: 0,
      mic_noise_suppression: 1,
      mic_auto_gain: 0,
      microphone_label: 'Built-in',
      questionnaire_version: '2026-11-24',
      app_language: 'de',
    });
    expect(Object.keys(row)).toEqual(STUDY_COLUMNS);
  });

  it('keeps an interviewed person apart from the student who collected the data', () => {
    const row = buildStudyRow(recording({
      studyData: serializeRunStudyData(study({
        respondent: 'other',
        respondentId: INTERVIEWEE,
        person: { birth_year: 1961, gender: 'female', years_in_wuerzburg: 40 },
      })),
    }));

    expect(row.participant_id).toBe(INTERVIEWEE);
    expect(row.collector_id).toBe(COLLECTOR);
    expect(row.respondent).toBe('other');
    expect(row.age).toBe(65);
    expect(row.lives_in_wuerzburg).toBe(1);
  });

  it('marks "keine Angabe" in its own column and leaves the answer empty', () => {
    const row = buildStudyRow(recording({
      studyData: serializeRunStudyData(study({
        person: { birth_year__no_answer: true, gender__no_answer: true, years_in_wuerzburg__no_answer: true },
      })),
    }));

    expect(row.birth_year).toBeNull();
    expect(row.birth_year__no_answer).toBe(1);
    expect(row.age).toBeNull();
    expect(row.gender).toBeNull();
    expect(row.gender__no_answer).toBe(1);
    expect(row.years_in_wuerzburg).toBeNull();
    expect(row.years_in_wuerzburg__no_answer).toBe(1);
    expect(row.lives_in_wuerzburg).toBeNull();
  });

  it('fills only the columns of the group that was answered', () => {
    const row = buildStudyRow(recording({
      groupId: 'taktung',
      studyData: serializeRunStudyData(study({
        groupId: 'taktung',
        groupAnswers: { personen_blickfeld: 3, geschaefte_offen__na: true, weihnacht_gestaltung: 5 },
      })),
    }));

    expect(row.group_id).toBe('taktung');
    expect(row.taktung__personen_blickfeld).toBe(3);
    expect(row.taktung__geschaefte_offen).toBeNull();
    expect(row.taktung__geschaefte_offen__na).toBe(1);
    expect(row.taktung__weihnacht_gestaltung).toBe(5);

    const otherGroups = Object.entries(row)
      .filter(([column]) => column.includes('__') && !column.startsWith('taktung__'));
    expect(otherGroups.length).toBeGreaterThan(50);
    expect(otherGroups.every(([, value]) => value === null)).toBe(true);
  });

  it('uses the device participant for measurements from before IDs were stored', () => {
    const row = buildStudyRow(
      recording({ studyData: undefined, participantId: undefined }),
      { participantId: COLLECTOR, personAnswers: { birth_year: 2001, gender: 'diverse' } }
    );

    expect(row.participant_id).toBe(COLLECTOR);
    expect(row.birth_year).toBe(2001);
    expect(row.visit_mode).toBeNull();
    expect(row.run_number).toBeNull();
  });
});

describe('CSV output', () => {
  it('quotes separators, quotes and line breaks', () => {
    expect(toCsvCell('plain')).toBe('plain');
    expect(toCsvCell('a,b')).toBe('"a,b"');
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(toCsvCell('line 1\nline 2')).toBe('"line 1\nline 2"');
    expect(toCsvCell(null)).toBe('');
    expect(toCsvCell(0)).toBe('0');
    expect(toCsvCell(-0.25)).toBe('-0.25');
  });

  it('stops free text from running as a spreadsheet formula', () => {
    expect(toCsvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(toCsvCell('@cmd')).toBe("'@cmd");
    expect(toCsvCell('-5')).toBe('-5');
    expect(toCsvCell('- laut')).toBe("'- laut");
  });

  it('writes a header-only file with a byte order mark when there is no data', () => {
    const csv = formatAsStudyCSV([]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.slice(1).trimEnd().split(',')).toEqual(STUDY_COLUMNS);
  });

  it('keeps free text with commas in one cell', () => {
    const csv = formatAsStudyCSV([recording({ fieldNotes: 'Markt, viele Menschen; "laut"' })]);
    expect(csv).toContain('"Markt, viele Menschen; ""laut"""');
  });

  it('produces a codebook with the question wording of the groups', () => {
    const codebook = formatCodebookCSV();
    expect(codebook).toContain('taktung__personen_blickfeld');
    expect(codebook).toContain('In welchem Jahr sind Sie geboren?');
    expect(codebook).toContain('Sind Sie an diesem Ort gerade nur auf der Durchreise oder halten Sie sich hier auf?');
  });
});

describe('local time', () => {
  it('converts to the time zone of the recording', () => {
    expect(toLocalTimestamp('2026-07-01T22:30:00.000Z', 'Europe/Berlin')).toBe('2026-07-02 00:30:00');
    expect(toLocalTimestamp('not a date', 'Europe/Berlin')).toBeNull();
  });
});
