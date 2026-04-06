/**
 * Creates or promotes an admin account.
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-admin.ts
 *
 * Set ADMIN_ACCOUNT / ADMIN_PASSWORD / ADMIN_NICKNAME in .env or pass as env vars.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const account = (process.env.ADMIN_ACCOUNT ?? 'admin').trim().toLowerCase();
  const password = (process.env.ADMIN_PASSWORD ?? 'admin123456').trim();
  const nickname = (process.env.ADMIN_NICKNAME ?? 'Admin').trim();

  const existing = await prisma.user.findFirst({ where: { username: account } });

  if (existing) {
    // Promote existing account to admin
    await prisma.user.update({
      where: { id: existing.id },
      data: { isAdmin: true, isGuest: false },
    });
    console.log(`✅ Promoted existing account "${account}" to admin (id: ${existing.id})`);
  } else {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: account,
        nickname,
        passwordHash: hash,
        isGuest: false,
        isAdmin: true,
      },
    });
    console.log(`✅ Created admin account "${account}" (id: ${user.id})`);
    console.log(`   Password: ${password}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
