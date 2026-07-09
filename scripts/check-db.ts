import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.count();
  const departments = await prisma.department.count();
  const leaveTypes = await prisma.leaveType.count();
  const positions = await prisma.position.count();
  console.log({ employees, departments, leaveTypes, positions });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
