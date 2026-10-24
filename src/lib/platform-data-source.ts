import type { FundingItem, JobItem, ToolItem } from "@/lib/platform-types";

export interface PlatformDataSource {
  getFundings(): Promise<FundingItem[]>;
  getJobs(): Promise<JobItem[]>;
  getTools(): Promise<ToolItem[]>;
}
