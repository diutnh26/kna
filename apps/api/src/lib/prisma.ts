import { PrismaClient } from "@prisma/client";
import { triggerSync } from "./syncTrigger";

const prismaClientSingleton = () => {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);

          const syncModels = ["ArchiveEntry", "KnowledgeCard", "Phrase", "Listing"];
          const writeOps = ["create", "update", "delete", "upsert", "createMany", "updateMany", "deleteMany"];

          if (model && syncModels.includes(model) && writeOps.includes(operation)) {
            triggerSync(prisma as unknown as PrismaClient);
          }

          return result;
        },
      },
    },
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? (prismaClientSingleton() as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
