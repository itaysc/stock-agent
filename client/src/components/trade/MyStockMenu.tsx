import { ActionIcon, Menu } from '@mantine/core';
import { IconDots, IconPencil } from '@tabler/icons-react';
import type { MyPosition } from '../../api/trade-types';
import { useIsMobile } from '../../hooks/useIsMobile';

export type MyAction = 'trade' | 'chart' | 'sell-all' | 'levels';

/** The ⋯ menu of one of your stocks. */
export function MyStockMenu({
  p,
  onAction,
}: {
  p: MyPosition;
  onAction: (p: MyPosition, a: MyAction) => void;
}) {
  // On a phone: an edit icon (what to do with it), easier to recognize than ⋯.
  const mobile = useIsMobile();
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          size="lg"
          aria-label={`Actions for ${p.symbol}`}
          onClick={(e) => e.stopPropagation()}
        >
          {mobile ? <IconPencil size={18} /> : <IconDots size={16} />}
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Item onClick={() => onAction(p, 'trade')}>Buy more / sell some</Menu.Item>
        <Menu.Item onClick={() => onAction(p, 'chart')}>Open the chart</Menu.Item>
        <Menu.Item onClick={() => onAction(p, 'levels')}>Set stop / target</Menu.Item>
        <Menu.Item color="red" onClick={() => onAction(p, 'sell-all')}>
          Sell all
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
