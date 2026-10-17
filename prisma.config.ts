import 'dotenv/config'
import { defineConfig } from "@prisma/config";
import { loadEnvConfig } from "@next/env";

// 加载 Next.js 的环境变量
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;

// 如果本地没有配置环境变量，给一个默认的 SQLite 占位，防止 build 报错
const finalUrl = url || "file:./dev.db";

export default defineConfig({
  // 关键修正：这里必须指向你的 schema 文件路径
  schema: "prisma/schema.prisma", 
  datasource: { 
    url: finalUrl 
  },
});