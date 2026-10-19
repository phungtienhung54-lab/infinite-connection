import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { JobsBrowser } from "@/components/JobsBrowser";
import { PublishedContentSection } from "@/components/PublishedContentSection";
import "../platform.css";

export const metadata = {
  title: "人力资源 · 无限连接",
};

export default function HrPage() {
  return (
    <div className="module-page">
      <SiteHeader active="hr" />
      <JobsBrowser />
      <PublishedContentSection module="JOB" />
      <PlatformFooter />
    </div>
  );
}
