import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ContextScreen from './ContextScreen';

jest.mock('./HabitatSelector', () => () => null);
jest.mock('./SettingChips', () => () => null);

function renderScreen(overrides: Partial<React.ComponentProps<typeof ContextScreen>> = {}) {
  const props: React.ComponentProps<typeof ContextScreen> = {
    habitatType: null,
    settingContext: null,
    visitMode: null,
    siteCode: '',
    respondent: 'self',
    respondentPerson: {},
    respondentConsent: false,
    locationError: 'GPS unavailable',
    onHabitatChange: jest.fn(),
    onSettingContextChange: jest.fn(),
    onVisitModeChange: jest.fn(),
    onSiteCodeChange: jest.fn(),
    onRespondentChange: jest.fn(),
    onRespondentPersonChange: jest.fn(),
    onRespondentConsentChange: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };

  return { props, ...render(<ContextScreen {...props} />) };
}

describe('ContextScreen', () => {
  it('does not continue before the passing-by / staying question is answered', () => {
    const { props, getByLabelText, getByText } = renderScreen();

    fireEvent.press(getByLabelText('Continue'));

    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(getByText('Please answer the marked questions.')).toBeTruthy();
  });

  it('reports the chosen visit mode and continues once it is answered', () => {
    const first = renderScreen();
    fireEvent.press(first.getByLabelText('I am staying here'));
    expect(first.props.onVisitModeChange).toHaveBeenCalledWith('staying');
    first.unmount();

    const second = renderScreen({ visitMode: 'staying' });
    fireEvent.press(second.getByLabelText('Continue'));
    expect(second.props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('asks for the details and consent of an interviewed person', () => {
    const { props, getByLabelText, getByText } = renderScreen({
      visitMode: 'passing',
      respondent: 'other',
    });

    expect(getByText('About the person you interviewed')).toBeTruthy();

    fireEvent.press(getByLabelText('Continue'));
    expect(props.onConfirm).not.toHaveBeenCalled();

    fireEvent.press(getByLabelText('The person agreed to take part and to their answers being stored.'));
    expect(props.onRespondentConsentChange).toHaveBeenCalledWith(true);
  });

  it('continues for an interview when the person details are complete', () => {
    const { props, getByLabelText } = renderScreen({
      visitMode: 'passing',
      respondent: 'other',
      respondentPerson: { birth_year: 1990, gender: 'female', years_in_wuerzburg__na: true },
      respondentConsent: true,
    });

    fireEvent.press(getByLabelText('Continue'));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });
});
