const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function run() {
  try {
    const empresa = await prisma.empresa.findFirst();
    if (empresa) {
      let env = fs.readFileSync('.env', 'utf8');
      if (env.includes('DEFAULT_TENANT_ID')) {
        env = env.replace(/DEFAULT_TENANT_ID=.*/, `DEFAULT_TENANT_ID="${empresa.id}"`);
      } else {
        env += `\nDEFAULT_TENANT_ID="${empresa.id}"\n`;
      }
      fs.writeFileSync('.env', env);
      console.log('Env updated with ID:', empresa.id);
    } else {
      console.log('No empresa found');
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
