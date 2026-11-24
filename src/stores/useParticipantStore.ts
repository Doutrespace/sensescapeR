import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { LoggingService } from '../services/logging';
import { CONSENT_VERSION, PERSON_ITEMS } from '../study/core';
import type { RespondentType } from '../study/runData';
import { missingRequiredItems, sanitizeAnswers, type Answers } from '../study/types';
import { createUuid, toParticipantCode } from '../utils/ids';

/**
 * The person using this device as a study participant.
 *
 * A random participant ID is created the first time the app runs and stays
 * with the browser / phone, so all measurements made on it can be linked to
 * one participant without knowing who that is. The personal details asked
 * once (Teil 1) and the consent are stored next to it.
 */
const STORAGE_KEY = 'sensescape.participant.v1';

export type { RespondentType };

export interface ParticipantConsent {
  version: string;
  givenAt: string;
}

interface PersistedParticipant {
  participantId: string;
  createdAt: string;
  consent: ParticipantConsent | null;
  /** Answers to Teil 1 (keys of PERSON_ITEMS). */
  personAnswers: Answers;
  personCompletedAt: string | null;
  /** Personal questions of a project group, asked once: groupId -> answers. */
  groupPersonAnswers: Record<string, Answers>;
  lastGroupId: string | null;
  lastRespondent: RespondentType;
  /** Number of measurements saved on this device so far. */
  runCounter: number;
}

interface ParticipantStoreState extends PersistedParticipant {
  isLoaded: boolean;
  initialize: () => Promise<void>;
  completeSetup: (personAnswers: Answers) => Promise<void>;
  updatePersonAnswers: (personAnswers: Answers) => Promise<void>;
  setGroupPersonAnswers: (groupId: string, answers: Answers) => Promise<void>;
  setLastGroupId: (groupId: string | null) => Promise<void>;
  setLastRespondent: (respondent: RespondentType) => Promise<void>;
  /** Counts one more saved measurement and returns its number. */
  nextRunNumber: () => Promise<number>;
  /** New participant on this device (e.g. a shared phone). Keeps saved measurements. */
  resetParticipant: () => Promise<void>;
}

function createEmptyParticipant(): PersistedParticipant {
  return {
    participantId: createUuid(),
    createdAt: new Date().toISOString(),
    consent: null,
    personAnswers: {},
    personCompletedAt: null,
    groupPersonAnswers: {},
    lastGroupId: null,
    lastRespondent: 'self',
    runCounter: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStored(value: unknown): PersistedParticipant | null {
  if (!isRecord(value) || typeof value.participantId !== 'string' || value.participantId.length < 8) {
    return null;
  }

  const consent = isRecord(value.consent)
    && typeof value.consent.version === 'string'
    && typeof value.consent.givenAt === 'string'
    ? { version: value.consent.version, givenAt: value.consent.givenAt }
    : null;

  const groupPersonAnswers: Record<string, Answers> = {};
  if (isRecord(value.groupPersonAnswers)) {
    for (const [groupId, answers] of Object.entries(value.groupPersonAnswers)) {
      if (isRecord(answers)) {
        groupPersonAnswers[groupId] = answers as Answers;
      }
    }
  }

  return {
    participantId: value.participantId,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    consent,
    personAnswers: isRecord(value.personAnswers) ? (value.personAnswers as Answers) : {},
    personCompletedAt: typeof value.personCompletedAt === 'string' ? value.personCompletedAt : null,
    groupPersonAnswers,
    lastGroupId: typeof value.lastGroupId === 'string' ? value.lastGroupId : null,
    lastRespondent: value.lastRespondent === 'other' ? 'other' : 'self',
    runCounter: typeof value.runCounter === 'number' && Number.isFinite(value.runCounter)
      ? Math.max(0, Math.floor(value.runCounter))
      : 0,
  };
}

function pickPersisted(state: ParticipantStoreState): PersistedParticipant {
  return {
    participantId: state.participantId,
    createdAt: state.createdAt,
    consent: state.consent,
    personAnswers: state.personAnswers,
    personCompletedAt: state.personCompletedAt,
    groupPersonAnswers: state.groupPersonAnswers,
    lastGroupId: state.lastGroupId,
    lastRespondent: state.lastRespondent,
    runCounter: state.runCounter,
  };
}

async function persist(state: ParticipantStoreState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pickPersisted(state)));
  } catch (error) {
    LoggingService.warn('Failed to store participant details', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const useParticipantStore = create<ParticipantStoreState>((set, get) => ({
  ...createEmptyParticipant(),
  isLoaded: false,

  initialize: async () => {
    if (get().isLoaded) {
      return;
    }

    let stored: PersistedParticipant | null = null;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      stored = raw ? normalizeStored(JSON.parse(raw)) : null;
    } catch (error) {
      LoggingService.warn('Failed to read participant details', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (stored) {
      set({ ...stored, isLoaded: true });
      return;
    }

    // First run on this device: keep the ID that was just generated.
    set({ isLoaded: true });
    await persist(get());
  },

  completeSetup: async (personAnswers) => {
    const now = new Date().toISOString();
    set({
      consent: { version: CONSENT_VERSION, givenAt: now },
      personAnswers: sanitizeAnswers(PERSON_ITEMS, personAnswers),
      personCompletedAt: now,
    });
    await persist(get());
  },

  updatePersonAnswers: async (personAnswers) => {
    set({
      personAnswers: sanitizeAnswers(PERSON_ITEMS, personAnswers),
      personCompletedAt: new Date().toISOString(),
    });
    await persist(get());
  },

  setGroupPersonAnswers: async (groupId, answers) => {
    set((state) => ({
      groupPersonAnswers: { ...state.groupPersonAnswers, [groupId]: answers },
    }));
    await persist(get());
  },

  setLastGroupId: async (lastGroupId) => {
    set({ lastGroupId });
    await persist(get());
  },

  setLastRespondent: async (lastRespondent) => {
    set({ lastRespondent });
    await persist(get());
  },

  nextRunNumber: async () => {
    const runNumber = get().runCounter + 1;
    set({ runCounter: runNumber });
    await persist(get());
    return runNumber;
  },

  resetParticipant: async () => {
    set({ ...createEmptyParticipant(), isLoaded: true });
    await persist(get());
  },
}));

/** Consent given for the current consent text and Teil 1 fully answered. */
export function isParticipantReady(state: Pick<ParticipantStoreState, 'isLoaded' | 'consent' | 'personAnswers'>): boolean {
  return state.isLoaded
    && state.consent?.version === CONSENT_VERSION
    && missingRequiredItems(PERSON_ITEMS, state.personAnswers).length === 0;
}

export function getParticipantCode(): string {
  return toParticipantCode(useParticipantStore.getState().participantId);
}
