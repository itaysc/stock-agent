import { Group, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

/** Param name with an "i" icon that explains it on hover (text comes from the server). */
export function ParamLabel({ name, description }: { name: string; description?: string }) {
  if (!description) return name;
  return (
    <Group gap={4} wrap="nowrap" component="span" style={{ display: 'inline-flex' }}>
      {name}
      <Tooltip label={description} multiline w={280} withArrow position="top-start">
        <IconInfoCircle
          size={14}
          aria-label={`About ${name}`}
          style={{ cursor: 'help', color: 'var(--mantine-color-dimmed)' }}
        />
      </Tooltip>
    </Group>
  );
}
