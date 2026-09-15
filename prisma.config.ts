import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Client generation needs the schema, not a live database connection.
    // Runtime and migration commands still require DATABASE_URL.
    url: process.env.DATABASE_URL ?? "",
  },
});
