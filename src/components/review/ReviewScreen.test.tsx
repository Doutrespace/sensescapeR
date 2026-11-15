import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ReviewScreen from './ReviewScreen';

jest.mock('../../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    isPlaying: false,
    isLoaded: true,
    duration: 15000,
    position: 0,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
  }),
}));

jest.mock('./SpectrogramPlayer', () => () => null);
jest.mock('./PlaybackControls', () => () => null);
jest.mock('../recording/QualityHints', () => () => null);

describe('ReviewScreen', () => {
  it('supports retake and continue actions with accessible controls', () => {
    const onContinue = jest.fn();
    const onRetake = jest.fn();

    const { getByLabelText, getByText, getAllByText, queryByText } = render(
      <ReviewScreen
        audioUri="file:///tmp/audio.wav"
        duration={15000}
        spectrogramUri="file:///tmp/spec.png"
        normalizationApplied
        normalizationGain={2}
        qualityFlags={{
          hasClipping: false,
          hasWindHandling: true,
          hasLowSNR: false,
          peakDb: -4.5,
          rmsDb: -18.2,
        }}
        onContinue={onContinue}
        onRetake={onRetake}
      />
    );

    expect(getByText('Quality flags')).toBeTruthy();
    expect(getByText('Playback leveled for a quiet device (2.0x).')).toBeTruthy();
    expect(getByText('100%')).toBeTruthy();
    expect(getByText('80%')).toBeTruthy();
    expect(getByText('Near clipping')).toBeTruthy();
    expect(getByText('Usable level')).toBeTruthy();
    expect(queryByText('-4.5 dB')).toBeNull();
    fireEvent.press(getByLabelText('Retake recording'));
    fireEvent.press(getByLabelText('Continue after review'));

    expect(onRetake).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
