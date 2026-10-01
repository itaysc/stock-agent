import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { IconPlugConnectedX } from '@tabler/icons-react';
import { Workspace } from './components/Workspace';
import { useOptions } from './hooks/useApi';

export function App() {
  const { options, error, waiting, retry } = useOptions();

  if (error) {
    return (
      <Center h="100vh" p="md">
        <Alert
          color="red"
          icon={<IconPlugConnectedX />}
          title="Can't load the backtest settings"
          maw={520}
        >
          <Stack gap="sm">
            <Text size="sm">{error}</Text>
            <Button variant="light" color="red" onClick={retry} w="fit-content">
              Try again
            </Button>
          </Stack>
        </Alert>
      </Center>
    );
  }
  if (!options) {
    return (
      <Center h="100vh" p="md">
        <Stack align="center" gap="xs">
          <Loader />
          {waiting && (
            <>
              <Text fw={600}>Waiting for the server…</Text>
              <Text size="sm" c="dimmed" ta="center" maw={360}>
                It usually takes a few seconds to start. If it isn&apos;t running, start it with{' '}
                <code>npm run dev</code> in the project root.
              </Text>
            </>
          )}
        </Stack>
      </Center>
    );
  }
  return <Workspace options={options} />;
}
