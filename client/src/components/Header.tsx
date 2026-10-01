import {
  ActionIcon,
  Badge,
  Group,
  SegmentedControl,
  Text,
  ThemeIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconChartLine, IconMoon, IconSparkles, IconSun } from '@tabler/icons-react';
import type { BacktestOptions } from '../api/types';

export type Page = 'broker' | 'lab' | 'paper';

interface Props {
  options: BacktestOptions;
  page: Page;
  onPage: (page: Page) => void;
}

export function Header({ options, page, onPage }: Props) {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon
          size={34}
          radius="md"
          variant="gradient"
          gradient={{ from: 'indigo', to: 'cyan' }}
        >
          <IconChartLine size={20} />
        </ThemeIcon>
        <div>
          <Text fw={700} lh={1.1}>
            Stock Invest
          </Text>
          <Text size="xs" c="dimmed" lh={1.1}>
            your paper broker
          </Text>
        </div>
      </Group>
      <SegmentedControl
        size="xs"
        value={page === 'broker' ? 'broker' : 'advanced'}
        onChange={(v) => onPage(v === 'broker' ? 'broker' : 'lab')}
        data={[
          { value: 'broker', label: 'Broker' },
          { value: 'advanced', label: 'Advanced' },
        ]}
      />
      <Group gap="xs" wrap="nowrap">
        <Tooltip label={`Market data feed; history from ${options.dataStart}`}>
          <Badge variant="light" color="gray" visibleFrom="xs">
            {options.dataFeed.toUpperCase()} data
          </Badge>
        </Tooltip>
        <Tooltip
          label={options.aiEnabled ? 'AI summaries are on' : 'Set OPENAI_API_KEY in server/.env'}
        >
          <Badge
            variant="light"
            color={options.aiEnabled ? 'violet' : 'gray'}
            leftSection={<IconSparkles size={12} />}
            visibleFrom="xs"
          >
            AI {options.aiEnabled ? 'on' : 'off'}
          </Badge>
        </Tooltip>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Toggle color scheme"
          onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
        >
          {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
      </Group>
    </Group>
  );
}
