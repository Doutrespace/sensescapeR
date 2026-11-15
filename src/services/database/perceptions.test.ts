import {
  calculateCircumplexFromPAQ,
  calculatePAQFromCircumplex,
  createPerception,
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

  it('auto-populates PAQ fields when persisting circumplex-only perceptions', async () => {
    const perception = await createPerception('rec-1', {
      pleasant: 0.7,
      eventful: 0.2,
    });

    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    expect(perception.paqPleasant).toBeGreaterThan(3);
    expect(perception.paqAnnoying).toBeLessThan(3);
    expect(perception.paqVibrant).toBeGreaterThan(3);
    expect(perception.paqCalm).toBeGreaterThanOrEqual(3);
  });
});
