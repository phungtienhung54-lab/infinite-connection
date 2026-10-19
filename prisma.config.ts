import 'dotenv/config'
import { defineConfig } from "@prisma/config";
import { loadEnvConfig } from "@next/env";

// 加载 Next.js 的环境变量
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is required: configure a PostgreSQL connection string before running Prisma.");
}
if (!/^postgres(ql)?:\/\//i.test(url)) {
  throw new Error("DATABASE_URL must be a PostgreSQL connection string (postgres:// or postgresql://).");
}

export default defineConfig({
  // 关键修正：这里必须指向你的 schema 文件路径
  schema: "prisma/schema.prisma", 
  datasource: {
    url,
  },
});