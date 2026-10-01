import type { Deployment } from '../paper/deployment.types.js';
import { deploymentView } from '../paper/deployment-view.js';

/**
 * Whether the autopilot should retire one of its deployments, and why
 * (null = keep it). Only ever applied to deployments it made itself.
 */
export function retireReason(
  d: Deployment,
  behindAfterDays: number,
): string | null {
  if (d.status === 'stopped') return null;
  const v = deploymentView(d);
  if (d.status === 'paused' && d.statusReason?.startsWith('Guard')) {
    return `its safety guard tripped (${d.statusReason})`;
  }
  if (v.health === 'deeper-drop') return v.healthText;
  if (v.health === 'behind' && v.daysLive >= behindAfterDays) {
    return `${v.healthText} after ${v.daysLive} trading days`;
  }
  return null;
}
