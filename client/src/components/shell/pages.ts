import {
  IconArrowsExchange,
  IconBriefcase,
  IconFlask,
  IconReceiptTax,
  IconRobot,
  IconUsers,
} from '@tabler/icons-react';
import type { Page } from '../Header';

export interface NavPage {
  page: Page;
  label: string;
  hint: string;
  icon: typeof IconBriefcase;
}

/** The app's pages, for the sidebar (computer) and the menu drawer (phone). */
export const NAV_PAGES: NavPage[] = [
  { page: 'broker', label: 'Broker', hint: 'It invests for you', icon: IconBriefcase },
  { page: 'trade', label: 'Trade', hint: 'Your own buys and sells', icon: IconArrowsExchange },
  { page: 'tax', label: 'Tax', hint: 'Records for the yearly report', icon: IconReceiptTax },
  { page: 'lab', label: 'Lab', hint: 'Backtests and AI research', icon: IconFlask },
  { page: 'paper', label: 'Paper & autopilot', hint: 'Test runs and the agent', icon: IconRobot },
];

/** The Accounts page (with the admin's users). */
export const accountsPage = (admin: boolean): NavPage => ({
  page: 'accounts',
  label: admin ? 'Accounts & users' : 'Accounts',
  hint: 'Your accounts',
  icon: IconUsers,
});
