import { Button } from '@mantine/core';
import { IconBrandAlpacaLogo } from './AlpacaLogo';
import { goToAlpaca } from '../../api/alpaca-auth-api';

/** "Log in with Alpaca" (or "Connect with Alpaca"): off to Alpaca's sign-in and back. */
export function AlpacaButton({
  mode,
  label,
  fullWidth = true,
}: {
  mode: 'login' | 'connect';
  label: string;
  fullWidth?: boolean;
}) {
  return (
    <Button
      variant="default"
      size="md"
      fullWidth={fullWidth}
      leftSection={<IconBrandAlpacaLogo />}
      onClick={() => goToAlpaca(mode)}
    >
      {label}
    </Button>
  );
}
