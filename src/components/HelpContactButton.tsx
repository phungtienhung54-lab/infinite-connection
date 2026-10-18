"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Contact = { phone: string; wechat: string };

export function HelpContactButton({ contentId }: { contentId: string }) {
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const revealContact = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/content/${contentId}/contact`);
      if (response.status === 401) {
        const callbackUrl = `${window.location.pathname}${window.location.search}`;
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "无法获取联系方式");
      setContact(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法获取联系方式");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" className="feed-action help" onClick={revealContact} disabled={loading}>
        🤝 {loading ? "正在获取…" : "搭把手"}
      </button>
      {(contact || error) && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="发布者联系方式">
          <div className="modal contact-modal">
            <div className="modal-head">
              <h2>联系发布者</h2>
              <button type="button" className="modal-close" onClick={() => { setContact(null); setError(""); }} aria-label="关闭">✕</button>
            </div>
            {error ? <p className="auth-error">{error}</p> : (
              <div className="contact-details">
                {contact?.phone && <p><span>手机号码</span><a href={`tel:${contact.phone}`}>{contact.phone}</a></p>}
                {contact?.wechat && <p><span>微信号</span><strong>{contact.wechat}</strong></p>}
                <small>请说明从“无限连接”看到该信息，并注意保护双方隐私。</small>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
