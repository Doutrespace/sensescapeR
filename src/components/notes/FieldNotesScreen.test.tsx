import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import FieldNotesScreen from './FieldNotesScreen';

describe('FieldNotesScreen', () => {
  it('captures notes and proceeds', () => {
    const onFieldNotesChange = jest.fn();
    const onSpokenDescriptionChange = jest.fn();
    const onContinue = jest.fn();

    const { getByLabelText } = render(
      <FieldNotesScreen
        fieldNotes=""
        spokenDescription=""
        onFieldNotesChange={onFieldNotesChange}
        onSpokenDescriptionChange={onSpokenDescriptionChange}
        onContinue={onContinue}
      />
    );

    fireEvent.changeText(getByLabelText('Field notes'), 'Birds and distant traffic');
    fireEvent.changeText(getByLabelText('Spoken description transcript'), 'Calm courtyard');
    fireEvent.press(getByLabelText('Continue from notes'));

    expect(onFieldNotesChange).toHaveBeenCalledWith('Birds and distant traffic');
    expect(onSpokenDescriptionChange).toHaveBeenCalledWith('Calm courtyard');
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows derived note themes from existing text', () => {
    const { getByText } = render(
      <FieldNotesScreen
        fieldNotes="Birds and distant traffic"
        spokenDescription="Quiet courtyard with voices"
        onFieldNotesChange={jest.fn()}
        onSpokenDescriptionChange={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(getByText('Detected note themes')).toBeTruthy();
    expect(getByText('Birds')).toBeTruthy();
    expect(getByText('Traffic')).toBeTruthy();
  });

  it('inserts guided prompt seeds into notes', () => {
    const onFieldNotesChange = jest.fn();

    const { getByLabelText } = render(
      <FieldNotesScreen
        fieldNotes=""
        spokenDescription=""
        onFieldNotesChange={onFieldNotesChange}
        onSpokenDescriptionChange={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    fireEvent.press(getByLabelText('What stood out acoustically?'));

    expect(onFieldNotesChange).toHaveBeenCalledWith('Dominant sounds: ');
  });
});
