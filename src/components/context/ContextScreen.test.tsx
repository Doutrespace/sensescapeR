import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ContextScreen from './ContextScreen';
import { usePreferencesStore } from '../../stores/usePreferencesStore';

jest.mock('./HabitatSelector', () => () => null);
jest.mock('./SettingChips', () => () => null);
jest.mock('../../stores/usePreferencesStore', () => ({
  usePreferencesStore: jest.fn(),
}));

describe('ContextScreen', () => {
  beforeEach(() => {
    (usePreferencesStore as unknown as jest.Mock).mockReturnValue({
      defaultCommunityVisibility: 'community',
      setDefaultCommunityVisibility: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('lets the user navigate sections and save or skip', () => {
    const onConfirm = jest.fn();
    const onCommunityVisibilityChange = jest.fn();

    const { getByLabelText, getByText } = render(
      <ContextScreen
        habitatType={null}
        settingContext={{ indoor: false, outdoor: true, alone: true, inGroup: false }}
        privacyMode="exact"
        communityVisibility="private"
        locationError="GPS unavailable"
        onHabitatChange={jest.fn()}
        onSettingContextChange={jest.fn()}
        onCommunityVisibilityChange={onCommunityVisibilityChange}
        onConfirm={onConfirm}
      />
    );

    fireEvent.press(getByLabelText('Save recording'));
    fireEvent.press(getByLabelText('Publish to the community'));
    fireEvent.press(getByText('Share & Save'));

    expect(onCommunityVisibilityChange).toHaveBeenNthCalledWith(1, 'community');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
