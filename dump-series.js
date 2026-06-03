require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const series = await prisma.serieConfig.findMany();
  console.log(JSON.stringify(series, null, 2));
}
main().finally(() => prisma.$disconnect());
