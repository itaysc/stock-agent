import type { LegalDoc } from './legal-types';
import { PRIVACY_A } from './privacy-a';
import { PRIVACY_B } from './privacy-b';

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  updated: 'October 28, 2026',
  summary:
    'We collect what the Service needs: your email, your brokerage credentials (encrypted) and the data of the accounts you connect. We use it only to run the Service, never for advertising, and we never sell it. AI providers receive only market information. You can ask to see, correct or delete your information at any time.',
  sections: [...PRIVACY_A, ...PRIVACY_B],
};
