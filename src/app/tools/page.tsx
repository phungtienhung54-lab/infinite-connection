import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { ToolsBrowser } from "@/components/ToolsBrowser";
import { platformDataSource } from "@/lib/platform-data-source-instance";
import "../platform.css";

export const metadata = {
  title: "能力工具 · 无限连接",
};

export default async function ToolsPage() {
  const tools = await platformDataSource.getTools();

  return (
    <div className="module-page">
      <SiteHeader active="tools" />
      <ToolsBrowser tools={tools} />
      <PlatformFooter />
    </div>
  );
}
