import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SaveVisibilitySheet from './SaveVisibilitySheet';
import { usePreferencesStore } from '../../stores/usePreferencesStore';

jest.mock('../../stores/usePreferencesStore', () => ({
  usePreferencesStore: jest.fn(),
}));

describe('SaveVisibilitySheet', () => {
  const setDefaultCommunityVisibility = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (usePreferencesStore as unknown as jest.Mock).mockReturnValue({
      defaultCommunityVisibility: 'private',
      setDefaultCommunityVisibility,
    });
  });

  it('hands the chosen visibility to the caller, which then saves', () => {
    const onConfirm = jest.fn();
    const { getByLabelText, getByText } = render(
      <SaveVisibilitySheet
        visible
        privacyMode="exact"
        communityVisibility="private"
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.press(getByLabelText('Publish to the community'));
    fireEvent.press(getByText('Share & Save'));

    expect(onConfirm).toHaveBeenCalledWith('community');
    expect(setDefaultCommunityVisibility).not.toHaveBeenCalled();
  });

  it('keeps the measurement private by default and can remember the choice', () => {
    const onConfirm = jest.fn();
    const { getByLabelText, getByText } = render(
      <SaveVisibilitySheet
        visible
        privacyMode="exact"
        communityVisibility="private"
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.press(getByLabelText('Use this visibility for future recordings'));
    fireEvent.press(getByText('Save Private'));

    expect(onConfirm).toHaveBeenCalledWith('private');
    expect(setDefaultCommunityVisibility).toHaveBeenCalledWith('private');
  });
});
