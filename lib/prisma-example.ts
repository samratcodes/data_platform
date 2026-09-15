import { prisma } from "./prisma";

/**
 * Example Prisma query against the introspected providers table.
 * Call this only from a server-side route, server action, or script.
 */
export async function listRecentProviders() {
  return prisma.providers.findMany({
    orderBy: { created_at: "desc" },
    take: 10,
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      country: true,
      provider_type: true,
      status: true,
      verification_level: true,
    },
  });
}
