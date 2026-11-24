/**
 * `Alert.alert` does nothing in react-native-web, which would silently drop
 * every confirmation in the app (cancel recording, delete, sign out, ...).
 * This renders a small in-page dialog with the same title/message/buttons
 * contract as the native alert.
 */
interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

const COLORS = {
  backdrop: 'rgba(23, 23, 23, 0.45)',
  surface: '#FFFFFF',
  text: '#171717',
  muted: '#6E685D',
  primary: '#171717',
  destructive: '#B55245',
  border: '#E3DED4',
};

function styleElement(element: HTMLElement, style: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, style);
}

export function showWebAlert(
  title?: string,
  message?: string,
  buttons?: AlertButton[]
): void {
  if (typeof document === 'undefined') {
    return;
  }

  const resolvedButtons: AlertButton[] = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const backdrop = document.createElement('div');
  styleElement(backdrop, {
    position: 'fixed',
    inset: '0',
    zIndex: '100000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: COLORS.backdrop,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  });

  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  styleElement(dialog, {
    width: '100%',
    maxWidth: '340px',
    background: COLORS.surface,
    borderRadius: '20px',
    padding: '22px 20px 16px',
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.22)',
    boxSizing: 'border-box',
  });

  if (title) {
    const heading = document.createElement('div');
    heading.textContent = title;
    styleElement(heading, {
      fontSize: '17px',
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: message ? '8px' : '16px',
    });
    dialog.appendChild(heading);
  }

  if (message) {
    const body = document.createElement('div');
    body.textContent = message;
    styleElement(body, {
      fontSize: '14px',
      lineHeight: '20px',
      color: COLORS.muted,
      marginBottom: '18px',
      whiteSpace: 'pre-wrap',
    });
    dialog.appendChild(body);
  }

  const actions = document.createElement('div');
  styleElement(actions, {
    display: 'flex',
    flexDirection: resolvedButtons.length > 2 ? 'column' : 'row',
    justifyContent: 'flex-end',
    gap: '8px',
  });

  const close = (button?: AlertButton) => {
    document.removeEventListener('keydown', onKeyDown, true);
    backdrop.remove();
    previouslyFocused?.focus?.();
    button?.onPress?.();
  };

  const cancelButton = resolvedButtons.find((button) => button.style === 'cancel');
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close(cancelButton ?? (resolvedButtons.length === 1 ? resolvedButtons[0] : undefined));
    }
  };

  let primaryElement: HTMLButtonElement | null = null;
  resolvedButtons.forEach((button) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = button.text ?? 'OK';
    const isCancel = button.style === 'cancel';
    const isDestructive = button.style === 'destructive';
    styleElement(element, {
      flex: resolvedButtons.length === 2 ? '1' : '0 0 auto',
      minHeight: '44px',
      padding: '0 16px',
      borderRadius: '12px',
      border: isCancel ? `1px solid ${COLORS.border}` : 'none',
      background: isCancel ? 'transparent' : isDestructive ? COLORS.destructive : COLORS.primary,
      color: isCancel ? COLORS.text : '#FFFFFF',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
    });
    element.addEventListener('click', () => close(button));
    actions.appendChild(element);
    if (!isCancel && !primaryElement) {
      primaryElement = element;
    }
  });

  dialog.appendChild(actions);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
  document.addEventListener('keydown', onKeyDown, true);
  ((primaryElement ?? actions.firstElementChild) as HTMLElement | null)?.focus?.();
}
