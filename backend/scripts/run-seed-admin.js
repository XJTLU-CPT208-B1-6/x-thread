const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const account = process.env.ADMIN_ACCOUNT || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123456';
  const nickname = process.env.ADMIN_NICKNAME || 'Admin';

  const existing = await prisma.user.findFirst({ where: { username: account } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { isAdmin: true, isGuest: false } });
    console.log('Promoted "' + account + '" to admin. id=' + existing.id);
  } else {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username: account, nickname, passwordHash: hash, isGuest: false, isAdmin: true },
    });
    console.log('Created admin account "' + account + '". id=' + user.id);
    console.log('Password: ' + password);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
