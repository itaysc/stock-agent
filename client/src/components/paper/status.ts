import type { DeploymentView, Health } from '../../api/paper-types';

export const STATUS_COLOR: Record<DeploymentView['status'], string> = {
  active: 'teal',
  paused: 'orange',
  stopped: 'gray',
};

export const HEALTH: Record<Health, { color: string; label: string }> = {
  'warming-up': { color: 'gray', label: 'Too early to judge' },
  'on-track': { color: 'teal', label: 'In line with the backtest' },
  behind: { color: 'orange', label: 'Behind the backtest' },
  'deeper-drop': { color: 'red', label: 'Dropping more than expected' },
};
