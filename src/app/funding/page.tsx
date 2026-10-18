import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { FundingBrowser } from "@/components/FundingBrowser";
import { PublishedContentSection } from "@/components/PublishedContentSection";
import "../platform.css";

export const metadata = {
  title: "资金&物资 · 无限连接",
};

export default function FundingPage() {
  return (
    <div className="module-page">
      <SiteHeader active="funding" />
      <FundingBrowser />
      <PublishedContentSection module="FUNDING" />
      <PlatformFooter />
    </div>
  );
}
