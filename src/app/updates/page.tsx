import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { UpdatesBrowser } from "@/components/UpdatesBrowser";
import { PublishedContentSection } from "@/components/PublishedContentSection";
import "../platform.css";

export const metadata = {
  title: "项目动态 · 无限连接",
};

export default function UpdatesPage() {
  return (
    <div className="module-page">
      <SiteHeader active="updates" />
      <UpdatesBrowser />
      <PublishedContentSection module="UPDATE" />
      <PlatformFooter />
    </div>
  );
}
