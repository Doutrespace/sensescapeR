import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ProtocolSelector from './ProtocolSelector';

describe('ProtocolSelector', () => {
  it('updates protocol selection and advances', () => {
    const onProtocolChange = jest.fn();
    const onDurationChange = jest.fn();
    const onConfirm = jest.fn();

    const { getByLabelText } = render(
      <ProtocolSelector
        selectedProtocol="opportunistic"
        selectedDuration={30}
        onProtocolChange={onProtocolChange}
        onDurationChange={onDurationChange}
        onConfirm={onConfirm}
      />
    );

    fireEvent.press(getByLabelText('Stationary 60s protocol'));
    fireEvent.press(getByLabelText('Continue to recording'));

    expect(onProtocolChange).toHaveBeenCalledWith('stationary_60s');
    expect(onDurationChange).toHaveBeenCalledWith(60000);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
