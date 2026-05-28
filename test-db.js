const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.empresa.findFirst();
    console.log("findFirst result:", res);
  } catch(e) {
    console.error("Error in findFirst:", e);
  }
}
main()
  .finally(async () => {
    await prisma.$disconnect();
  });
