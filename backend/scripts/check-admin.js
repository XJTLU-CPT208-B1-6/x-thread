const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findFirst({ where: { username: 'admin' } })
  .then(u => { console.log(JSON.stringify(u, null, 2)); })
  .catch(console.error)
  .finally(() => p.$disconnect());
