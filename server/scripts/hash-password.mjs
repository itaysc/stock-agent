// Prints a bcrypt hash of a password, for ADMIN_PASSWORD_HASH. The password is
// typed (hidden), never passed on the command line or stored.
//   npm run hash-password
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';

stdout.write('Password (hidden): ');
stdin.setRawMode?.(true);
let password = '';
stdin.on('data', (chunk) => {
  for (const ch of chunk.toString('utf8')) {
    if (ch === '\u0003') process.exit(1); // Ctrl+C
    if (ch === '\r' || ch === '\n') {
      stdin.setRawMode?.(false);
      stdout.write('\n');
      if (password.length < 10) {
        console.error('Use at least 10 characters.');
        process.exit(1);
      }
      console.log(`ADMIN_PASSWORD_HASH=${bcrypt.hashSync(password, 12)}`);
      process.exit(0);
    }
    if (ch === '\u007f') password = password.slice(0, -1);
    else password += ch;
  }
});
