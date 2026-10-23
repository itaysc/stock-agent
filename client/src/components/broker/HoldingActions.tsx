import { ActionIcon, Menu } from '@mantine/core';
import {
  IconAdjustments,
  IconChartLine,
  IconDots,
  IconPencil,
  IconCashBanknote,
  IconX,
} from '@tabler/icons-react';
import type { BrokerHolding } from '../../api/broker-types';
import { useIsMobile } from '../../hooks/useIsMobile';

export type HoldingAction = 'chart' | 'sell-all' | 'sell-half' | 'levels' | 'clear-levels';

/** The ⋯ menu of one holding. */
export function HoldingActions({
  holding,
  onAction,
}: {
  holding: BrokerHolding;
  onAction: (action: HoldingAction) => void;
}) {
  // On a phone: an edit icon (what to do with it), easier to recognize than ⋯.
  const mobile = useIsMobile();
  const selling = holding.label === 'Selling';
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          size="lg"
          aria-label={`Actions for ${holding.symbol}`}
          onClick={(e) => e.stopPropagation()}
        >
          {mobile ? <IconPencil size={18} /> : <IconDots size={16} />}
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Item leftSection={<IconChartLine size={14} />} onClick={() => onAction('chart')}>
          Chart
        </Menu.Item>
        <Menu.Label>Sell now</Menu.Label>
        <Menu.Item
          leftSection={<IconCashBanknote size={14} />}
          disabled={selling}
          onClick={() => onAction('sell-all')}
        >
          Sell all and choose a replacement…
        </Menu.Item>
        <Menu.Item
          leftSection={<IconCashBanknote size={14} />}
          disabled={selling}
          onClick={() => onAction('sell-half')}
        >
          Sell half (take some profit)
        </Menu.Item>
        <Menu.Label>Your levels</Menu.Label>
        <Menu.Item
          leftSection={<IconAdjustments size={14} />}
          disabled={selling}
          onClick={() => onAction('levels')}
        >
          Set my stop loss / profit target…
        </Menu.Item>
        {(holding.stopIsYours || holding.takeIsYours) && (
          <Menu.Item leftSection={<IconX size={14} />} onClick={() => onAction('clear-levels')}>
            Back to automatic levels
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
