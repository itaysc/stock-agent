import { Anchor, Checkbox, Text } from '@mantine/core';

/** "I agree to the Terms of Use and the Privacy Policy" (required to sign up; the server records it). */
export function AcceptTerms({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      onChange={(e) => onChange(e.currentTarget.checked)}
      label={
        <Text size="sm">
          I agree to the{' '}
          <Anchor href="/terms" target="_blank" inherit>
            Terms of Use
          </Anchor>{' '}
          and the{' '}
          <Anchor href="/policy" target="_blank" inherit>
            Privacy Policy
          </Anchor>
          , and I understand that Bullwether is not investment advice and that I am responsible for
          my investments.
        </Text>
      }
    />
  );
}
