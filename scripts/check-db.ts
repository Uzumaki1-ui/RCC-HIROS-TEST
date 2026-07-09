import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.count();
  const groups = await prisma.group.count();
  const leaveTypes = await prisma.leaveType.count();
  const roles = await prisma.role.count();
  console.log({ employees, groups, leaveTypes, roles });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
