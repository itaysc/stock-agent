import { LEGAL_EMAIL, type LegalSection } from './legal-types';

/** Terms of Use, sections 10–22 (your account, use, liability, law, contact). */
export const TERMS_B: LegalSection[] = [
  {
    id: 'account',
    title: '10. Your user, credentials and security',
    body: [
      'Keep your password, API keys and devices secure. You are responsible for all activity under your user and in every account you connect. Tell us immediately at ' +
        LEGAL_EMAIL +
        ' if you suspect unauthorized access, and revoke the affected keys or access in Alpaca. You must provide accurate information (including your email) and keep it current.',
    ],
  },
  {
    id: 'use',
    title: '11. Acceptable use',
    body: [
      'You agree not to:',
      {
        list: [
          'use the Service in violation of any law or regulation, including securities, market-abuse, sanctions and anti-money-laundering laws, or for market manipulation of any kind;',
          'connect a brokerage account that is not yours, or use the Service on behalf of others or as a service to others;',
          'access the Service by automated means other than its published API, overload, disrupt, probe or circumvent its security, or reverse engineer it except where the law permits;',
          'misrepresent your identity, share your access with others, or resell or commercially exploit the Service.',
        ],
      },
    ],
  },
  {
    id: 'fees',
    title: '12. Price',
    body: [
      'The Service is currently free. We may introduce paid features in the future; we will tell you before any charge applies, and nothing will be charged without your explicit agreement. Fees charged by your broker or other third parties are your responsibility.',
    ],
  },
  {
    id: 'changes-service',
    title: '13. Changes to the Service; suspension and termination',
    body: [
      'We may change, add or remove features, limit use, or suspend or discontinue the Service, in whole or in part, at any time, with or without notice, including for security, legal or technical reasons. We may suspend or terminate your access if we believe you breached these Terms or created risk or legal exposure for us or others.',
      'You may stop using the Service at any time. Before leaving, stop your investments and check your brokerage account: positions and orders in your brokerage account are not closed automatically when you stop using the Service. Sections that by their nature should survive termination (including 3–9 and 14–21) survive it.',
    ],
  },
  {
    id: 'ip',
    title: '14. Intellectual property',
    body: [
      'The Service, its software, design and content are owned by Bullwether or its licensors. We grant you a limited, personal, revocable, non-exclusive, non-transferable license to use the Service under these Terms. If you send us feedback, we may use it without any obligation to you.',
    ],
  },
  {
    id: 'warranties',
    title: '15. Disclaimer of warranties',
    body: [
      'THE SERVICE AND ALL INFORMATION, DATA, CONTENT AND RESULTS ARE PROVIDED "AS IS" AND "AS AVAILABLE", WITH ALL FAULTS AND WITHOUT WARRANTIES OF ANY KIND, EXPRESS, IMPLIED OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, NON-INFRINGEMENT AND UNINTERRUPTED OR ERROR-FREE OPERATION. WE DO NOT WARRANT THAT ANY STRATEGY WILL BE PROFITABLE OR THAT ORDERS WILL BE PLACED, EXECUTED OR CANCELLED AS INTENDED.',
    ],
  },
  {
    id: 'liability',
    title: '16. Limitation of liability',
    body: [
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, BULLWETHER AND ITS OWNERS, OPERATORS, CONTRIBUTORS AND SERVICE PROVIDERS WILL NOT BE LIABLE FOR ANY TRADING OR INVESTMENT LOSSES, LOST PROFITS OR OPPORTUNITIES, LOSS OF DATA, OR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, ARISING FROM OR RELATED TO THE SERVICE OR THESE TERMS, HOWEVER CAUSED AND UNDER ANY THEORY OF LIABILITY, EVEN IF ADVISED OF THEIR POSSIBILITY.',
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ALL CLAIMS RELATED TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE 12 MONTHS BEFORE THE CLAIM AND (B) USD 100.',
      'Some laws do not allow certain limitations; where they apply, our liability is limited to the smallest extent the law permits. Nothing in these Terms limits liability that cannot be limited by law, such as for fraud or willful misconduct.',
    ],
  },
  {
    id: 'indemnity',
    title: '17. Your responsibility to us (indemnification)',
    body: [
      'You will indemnify and hold harmless Bullwether and its owners, operators and service providers from any claims, losses, damages, liabilities, costs and expenses (including reasonable legal fees) arising from your use of the Service, the orders placed in your accounts, your breach of these Terms or of any law, or your violation of the rights of any third party, including your broker.',
    ],
  },
  {
    id: 'release',
    title: '18. Release',
    body: [
      'To the maximum extent permitted by law, you release Bullwether and its owners, operators and service providers from claims relating to your investment and trading decisions and results, the acts or omissions of your broker and other third parties, and information provided by third parties.',
    ],
  },
  {
    id: 'law',
    title: '19. Governing law and jurisdiction',
    body: [
      'These Terms and any dispute related to them or to the Service are governed by the laws of the State of Israel, without regard to its conflict-of-laws rules. The competent courts in Tel Aviv-Yafo, Israel, have exclusive jurisdiction, and you consent to their jurisdiction. To the extent permitted by law, any claim will be brought individually and not as a class or representative action, and must be brought within one year after it arose.',
    ],
  },
  {
    id: 'changes',
    title: '20. Changes to these Terms',
    body: [
      'We may update these Terms. We will post the new version with its date, and for material changes we will give notice in the Service or by email and may ask you to accept them. Continuing to use the Service after the changes take effect means you accept them; if you do not, stop using the Service.',
    ],
  },
  {
    id: 'general',
    title: '21. General',
    body: [
      'These Terms and the Privacy Policy are the entire agreement between you and us about the Service. If any part is found unenforceable, the rest remains in effect and that part is enforced to the maximum extent permitted. Our not enforcing a right is not a waiver of it. You may not assign these Terms; we may assign them in connection with a reorganization, merger or sale. We are not liable for failures caused by events beyond our reasonable control. These Terms are written in English; any translation is for convenience only, and the English version governs.',
    ],
  },
  {
    id: 'contact',
    title: '22. Contact',
    body: [`Bullwether, legal and privacy matters: ${LEGAL_EMAIL}.`],
  },
];
