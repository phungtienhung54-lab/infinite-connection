import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { JobsBrowser } from "@/components/JobsBrowser";
import { platformDataSource } from "@/lib/platform-data-source-instance";
import "../platform.css";

export const metadata = {
  title: "人力资源 · 无限连接",
};

export default async function HrPage() {
  const jobs = await platformDataSource.getJobs();

  return (
    <div className="module-page">
      <SiteHeader active="hr" />
      <JobsBrowser jobs={jobs} />
      <PlatformFooter />
    </div>
  );
}
