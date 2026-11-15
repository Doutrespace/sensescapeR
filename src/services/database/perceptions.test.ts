import {
  calculateCircumplexFromPAQ,
  calculatePAQFromCircumplex,
  createPerception,
  getRatedPaq,
} from './perceptions';

const mockRunAsync = jest.fn();

jest.mock('./index', () => ({
  getDatabase: jest.fn(async () => ({
    runAsync: mockRunAsync,
  })),
}));

describe('perception derivation', () => {
  beforeEach(() => {
    mockRunAsync.mockReset();
  });

  it('derives neutral PAQ values from the circumplex center', () => {
    const paq = calculatePAQFromCircumplex({ pleasant: 0, eventful: 0 });

    expect(paq).toEqual({
      pleasant: 3,
      vibrant: 3,
      eventful: 3,
      chaotic: 3,
      annoying: 3,
      monotonous: 3,
      uneventful: 3,
      calm: 3,
    });
  });

  it('derives quadrant-consistent PAQ values from a calm position', () => {
    const paq = calculatePAQFromCircumplex({ pleasant: 0.8, eventful: -0.6 });

    expect(paq.pleasant).toBeGreaterThan(paq.annoying);
    expect(paq.calm).toBeGreaterThan(paq.chaotic);
    expect(paq.uneventful).toBeGreaterThan(paq.eventful);
  });

  it('round-trips PAQ and circumplex within a reasonable tolerance', () => {
    const original = { pleasant: 0.55, eventful: -0.35 };

    const derivedPaq = calculatePAQFromCircumplex(original);
    const roundTripped = calculateCircumplexFromPAQ(derivedPaq);

    expect(Math.sign(roundTripped.pleasant)).toBe(Math.sign(original.pleasant));
    expect(Math.sign(roundTripped.eventful)).toBe(Math.sign(original.eventful));
    expect(Math.abs(roundTripped.pleasant)).toBeGreaterThan(0.2);
    expect(Math.abs(roundTripped.eventful)).toBeGreaterThan(0.2);
  });

  it('leaves PAQ empty when only a circumplex point was given', async () => {
    const perception = await createPerception('rec-1', {
      pleasant: 0.7,
      eventful: 0.2,
    });

    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    expect(perception.isoPleasant).toBe(0.7);
    expect(perception.paqPleasant).toBeUndefined();
    expect(perception.paqCalm).toBeUndefined();

    const insertedValues = mockRunAsync.mock.calls[0][1] as unknown[];
    // id, recording id, two ISO coordinates, eight PAQ columns, timestamp
    expect(insertedValues.slice(4, 12)).toEqual(new Array(8).fill(null));
  });

  it('stores PAQ ratings that were actually given', async () => {
    const rated = {
      pleasant: 4, vibrant: 2, eventful: 2, chaotic: 1,
      annoying: 2, monotonous: 3, uneventful: 4, calm: 5,
    };
    const perception = await createPerception('rec-1', { pleasant: 0.4, eventful: -0.3 }, rated);

    expect(perception.paqCalm).toBe(5);
    expect(getRatedPaq(perception)).toEqual(rated);
  });

  it('treats PAQ values computed from the circumplex point as not rated', () => {
    const circumplex = { pleasant: 0.7, eventful: 0.2 };
    const derived = calculatePAQFromCircumplex(circumplex);

    // What older app versions stored for a circumplex-only rating.
    const legacyRow = {
      isoPleasant: circumplex.pleasant,
      isoEventful: circumplex.eventful,
      paqPleasant: derived.pleasant,
      paqVibrant: derived.vibrant,
      paqEventful: derived.eventful,
      paqChaotic: derived.chaotic,
      paqAnnoying: derived.annoying,
      paqMonotonous: derived.monotonous,
      paqUneventful: derived.uneventful,
      paqCalm: derived.calm,
    };

    expect(getRatedPaq(legacyRow)).toBeNull();
    expect(getRatedPaq({ ...legacyRow, paqCalm: derived.calm === 5 ? 4 : derived.calm + 1 })).not.toBeNull();
    expect(getRatedPaq({ isoPleasant: 0.1, isoEventful: 0.1 })).toBeNull();
    expect(getRatedPaq(undefined)).toBeNull();
  });
});
