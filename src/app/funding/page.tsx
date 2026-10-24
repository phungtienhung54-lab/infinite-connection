import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { FundingBrowser } from "@/components/FundingBrowser";
import { platformDataSource } from "@/lib/platform-data-source-instance";
import "../platform.css";

export const metadata = {
  title: "资金&物资 · 无限连接",
};

export default async function FundingPage() {
  const fundings = await platformDataSource.getFundings();

  return (
    <div className="module-page">
      <SiteHeader active="funding" />
      <FundingBrowser fundings={fundings} />
      <PlatformFooter />
    </div>
  );
}
