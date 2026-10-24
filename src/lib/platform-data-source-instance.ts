import "server-only";

import type { PlatformDataSource } from "@/lib/platform-data-source";
import { PrismaPlatformDataSource } from "@/lib/prisma-platform-data-source";

export const platformDataSource: PlatformDataSource = new PrismaPlatformDataSource();
