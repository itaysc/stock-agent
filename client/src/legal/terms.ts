import type { LegalDoc } from './legal-types';
import { TERMS_A } from './terms-a';
import { TERMS_B } from './terms-b';

export const TERMS: LegalDoc = {
  title: 'Terms of Use',
  updated: 'October 27, 2026',
  summary:
    'Bullwether is a software tool, not a broker or an adviser, and nothing in it is investment advice. Investing involves risk, including the loss of all the money you invest. You decide and you are solely responsible for every investment and every order placed in your account through Bullwether, which you use entirely at your own risk. Backtests and other figures are hypothetical. To the maximum extent the law allows, Bullwether is not liable for your losses.',
  sections: [...TERMS_A, ...TERMS_B],
};
