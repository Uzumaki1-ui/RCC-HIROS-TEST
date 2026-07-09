import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./db/custom.db",
});
const prisma = new PrismaClient({ adapter });

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
