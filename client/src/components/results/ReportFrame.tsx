import { Button, Group, Paper, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

/**
 * Embeds a generated HTML report. Not sandboxed: the server only allows
 * same-origin framing, which an opaque sandboxed origin fails. The report is
 * our own escaped output, served with a CSP that blocks all network access.
 */
export function ReportFrame({ url, title }: { url: string; title: string }) {
  return (
    <Paper p={0} style={{ overflow: 'hidden' }}>
      <Group justify="space-between" px="md" py="sm">
        <Text fw={600} size="sm">
          {title}
        </Text>
        <Button
          component="a"
          href={url}
          target="_blank"
          rel="noreferrer"
          variant="subtle"
          size="xs"
          rightSection={<IconExternalLink size={14} />}
        >
          Open in new tab
        </Button>
      </Group>
      <iframe
        key={url}
        src={url}
        title={title}
        style={{ width: '100%', height: '85vh', border: 0, display: 'block' }}
      />
    </Paper>
  );
}
