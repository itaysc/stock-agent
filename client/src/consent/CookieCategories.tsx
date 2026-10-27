import { Badge, Group, Stack, Switch, Text } from '@mantine/core';

/** The cookie categories (Customize): strictly necessary, always on; functional, your choice. */
export function CookieCategories({
  functional,
  onFunctional,
}: {
  functional: boolean;
  onFunctional: (allow: boolean) => void;
}) {
  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="sm" fw={600}>
            Strictly necessary
          </Text>
          <Text size="xs" c="dimmed">
            Login, security, the account you view, and this choice. Always on.
          </Text>
        </div>
        <Badge variant="light" color="gray">
          Always on
        </Badge>
      </Group>
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="sm" fw={600}>
            Functional
          </Text>
          <Text size="xs" c="dimmed">
            Remembers light or dark mode and whether the sidebar is open.
          </Text>
        </div>
        <Switch
          checked={functional}
          onChange={(e) => onFunctional(e.currentTarget.checked)}
          aria-label="Functional cookies"
        />
      </Group>
    </Stack>
  );
}
