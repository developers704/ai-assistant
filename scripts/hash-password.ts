/**
 * Hash a password for AUTH_USERS_JSON / users.ts
 *
 *   npx tsx scripts/hash-password.ts "MyNewPassword"
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error('Usage: npx tsx scripts/hash-password.ts "password"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
console.log("compare ok:", bcrypt.compareSync(password, hash));
