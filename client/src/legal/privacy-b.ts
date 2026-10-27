import { LEGAL_EMAIL, type LegalSection } from './legal-types';

/** Privacy Policy, sections 6–12 (keeping, protecting, transfers, your rights, contact). */
export const PRIVACY_B: LegalSection[] = [
  {
    id: 'retention',
    title: '6. How long we keep it',
    body: [
      'We keep your information while your user is active and as needed to provide the Service. When you delete a connected account in the Service, its credentials are deleted; the records of what happened in it (such as investments, orders and tax records) may be kept so they remain available if you reconnect it and to meet record-keeping obligations, unless you ask us to delete them. Logs are kept for a limited time. Some information may remain in backups for a limited period after deletion.',
    ],
  },
  {
    id: 'security',
    title: '7. How we protect it',
    body: [
      'We use measures appropriate to the information, including encryption of brokerage credentials at rest, hashing of passwords, encrypted connections (HTTPS), httpOnly login cookies and access limited to what each user may see. No system is perfectly secure, and we cannot guarantee the security of information. If we learn of a security incident affecting your information, we will notify you and the authorities as the law requires.',
      'You can also protect yourself: use a strong password, keep your devices secure, and revoke any key or access you no longer need in your broker’s settings.',
    ],
  },
  {
    id: 'transfers',
    title: '8. International transfers',
    body: [
      'Our service providers and your broker may process information in countries other than yours, including the United States and countries in Europe. When we transfer information abroad, we do so as permitted by applicable law, including the Israeli Privacy Protection (Transfer of Data to Databases Abroad) Regulations.',
    ],
  },
  {
    id: 'rights',
    title: '9. Your rights',
    body: [
      'Depending on where you live, you may have the right to access the information we hold about you, to correct it, to delete it, to object to or restrict certain uses, to receive a copy of it in a portable format, and to withdraw consent. Under Israeli law you may ask to review your information and to correct or delete information that is inaccurate, incomplete or out of date.',
      `To exercise your rights, email ${LEGAL_EMAIL} from the email address of your user. We may need to verify your identity, and we will answer within the time the law requires. You may also complain to a data protection authority, such as the Israeli Privacy Protection Authority.`,
      'You can revoke Bullwether’s access to your brokerage account at any time in your broker’s settings, or by deleting the account in the Service.',
    ],
  },
  {
    id: 'children',
    title: '10. Children',
    body: [
      'The Service is not intended for anyone under 18, and we do not knowingly collect information from them. If you believe a minor has given us information, contact us and we will delete it.',
    ],
  },
  {
    id: 'changes',
    title: '11. Changes to this policy',
    body: [
      'We may update this policy. We will post the new version with its date and, for material changes, give notice in the Service or by email.',
    ],
  },
  {
    id: 'contact',
    title: '12. Contact',
    body: [`Bullwether, privacy and data requests: ${LEGAL_EMAIL}.`],
  },
];
