"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveContent, type ContentFormState } from "@/lib/actions/content";
import {
  publicInterestFields,
  type PublishModuleConfig,
  type PublishModuleSlug,
} from "@/lib/publishing";

type InitialContent = {
  id: string;
  subtype: string;
  title: string;
  summary: string;
  body: string;
  fields: string[];
  tags: string[];
  region: string;
  city: string;
  metadata: Record<string, string>;
  attachments: { id: string; fileName: string }[];
};

const initialState: ContentFormState = {};
const MAX_IMAGES = 6;

const PROVINCE_CITIES: Record<string, string[]> = {
  北京市: ["北京市"],
  天津市: ["天津市"],
  上海市: ["上海市"],
  重庆市: ["重庆市"],
  河北省: ["石家庄市", "唐山市", "保定市"],
  辽宁省: ["沈阳市", "大连市"],
  江苏省: ["南京市", "苏州市", "无锡市", "常州市"],
  浙江省: ["杭州市", "宁波市", "温州市", "嘉兴市"],
  安徽省: ["合肥市", "芜湖市"],
  福建省: ["福州市", "厦门市", "泉州市"],
  山东省: ["济南市", "青岛市", "烟台市"],
  河南省: ["郑州市", "洛阳市"],
  湖北省: ["武汉市", "宜昌市"],
  湖南省: ["长沙市", "株洲市"],
  广东省: ["广州市", "深圳市", "珠海市", "佛山市", "东莞市"],
  海南省: ["海口市", "三亚市"],
  四川省: ["成都市", "绵阳市"],
  云南省: ["昆明市", "大理市"],
  陕西省: ["西安市", "咸阳市"],
  广西壮族自治区: ["南宁市", "桂林市"],
  内蒙古自治区: ["呼和浩特市", "包头市"],
  新疆维吾尔自治区: ["乌鲁木齐市"],
  香港特别行政区: ["香港特别行政区"],
  澳门特别行政区: ["澳门特别行政区"],
  台湾省: ["台北市", "高雄市"],
};

function TextField({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="publish-field">
      <span>{label}{required && <em>*</em>}</span>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} />
    </label>
  );
}

export function PublishForm({
  moduleSlug,
  config,
  identityName,
  identityNote,
  defaultContact,
  initial,
}: {
  moduleSlug: PublishModuleSlug;
  config: PublishModuleConfig;
  identityName: string;
  identityNote: string;
  defaultContact: { phone: string; wechat: string };
  initial?: InitialContent;
}) {
  const [contentId, setContentId] = useState(initial?.id ?? "");
  const [state, formAction, pending] = useActionState(async (previous: ContentFormState, formData: FormData) => {
    const result = await saveContent(previous, formData);
    if (result.contentId) setContentId(result.contentId);
    return result;
  }, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const submittedIntent = useRef<"submit" | "draft">("submit");
  const actionWasPending = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [attachments, setAttachments] = useState(initial?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedRegion, setSelectedRegion] = useState(initial?.region ?? "");
  const [selectedCity, setSelectedCity] = useState(initial?.city ?? "");
  const metadata = initial?.metadata ?? {};

  const provinceOptions = Array.from(new Set([
    ...Object.keys(PROVINCE_CITIES),
    ...(initial?.region ? [initial.region] : []),
  ]));
  const cityOptions = Array.from(new Set([
    ...(PROVINCE_CITIES[selectedRegion] ?? []),
    ...(selectedRegion === initial?.region && initial?.city ? [initial.city] : []),
  ]));

  useEffect(() => {
    if (pending) {
      actionWasPending.current = true;
      return;
    }
    if (!actionWasPending.current) return;
    actionWasPending.current = false;
    setIsSubmitting(false);
    setIsSavingDraft(false);
  }, [pending]);

  useEffect(() => {
    if (state.success && submittedIntent.current === "submit") {
      router.push("/updates");
    }
  }, [state, router]);

  const showPreview = () => {
    if (!formRef.current) return;
    const values = Object.fromEntries(new FormData(formRef.current).entries());
    setPreview(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])));
  };

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter ?? undefined);
    if (submitter instanceof HTMLButtonElement && submitter.name) {
      formData.set(submitter.name, submitter.value);
    }
    if (!formData.has("intent")) {
      formData.set("intent", "submit");
    }
    const body = String(formData.get("body") ?? "");
    if (/1[3-9]\d{9}/.test(body) || /\d{16,19}/.test(body)) {
      alert("正文不允许包含手机号或银行卡号");
      return;
    }
    const intent = formData.get("intent") === "draft" ? "draft" : "submit";
    submittedIntent.current = intent;
    setIsSavingDraft(intent === "draft");
    setIsSubmitting(intent === "submit");
    startTransition(() => formAction(formData));
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (attachments.length + files.length > MAX_IMAGES) {
      setUploadError(`每篇内容最多上传${MAX_IMAGES}张图片`);
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      for (const file of Array.from(files)) {
        const signResponse = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size }),
        });
        const signed = await signResponse.json();
        if (!signResponse.ok) throw new Error(signed.error ?? "无法上传图片");
        const uploadResponse = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadResponse.ok) throw new Error("图片上传失败，请重试");
        setAttachments((items) => [...items, { id: signed.attachmentId, fileName: file.name }]);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "图片上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <form ref={formRef} action={formAction} onSubmit={submitForm} className="publish-form pc-card">
        <input type="hidden" name="moduleSlug" value={moduleSlug} />
        <input type="hidden" name="contentId" value={contentId} />
        {attachments.map((attachment) => (
          <input key={attachment.id} type="hidden" name="attachmentIds" value={attachment.id} />
        ))}

        <div className="publisher-identity">
          <span className="user-avatar">{identityName.slice(0, 1)}</span>
          <div><strong>{identityName}</strong><small>{identityNote}</small></div>
        </div>

        {(state.error || state.message) && (
          <p className={state.error ? "publish-message error" : "publish-message success"}>
            {state.error ?? state.message}
          </p>
        )}

        <fieldset className="publish-fieldset">
          <legend>内容类型 <em>*</em></legend>
          <div className="choice-grid">
            {config.subtypes.map((subtype, index) => (
              <label key={subtype} className="choice-card">
                <input
                  type="radio"
                  name="subtype"
                  value={subtype}
                  defaultChecked={initial ? initial.subtype === subtype : index === 0}
                />
                <span>{subtype}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {moduleSlug === "funding" && (
          <fieldset className="publish-fieldset">
            <legend>发布方向 <em>*</em></legend>
            <div className="choice-grid compact">
              {["提供资源", "寻求资源"].map((direction, index) => (
                <label key={direction} className="choice-card">
                  <input type="radio" name="direction" value={direction} defaultChecked={metadata.direction ? metadata.direction === direction : index === 0} />
                  <span>{direction}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <TextField name="title" label="标题" required defaultValue={initial?.title} placeholder={`请输入${config.label}标题`} />
        <TextField name="summary" label="简介" defaultValue={initial?.summary} placeholder="120字以内，用一句话说明重点" />

        <label className="publish-field">
          <span>{config.bodyLabel}<em>*</em></span>
          <textarea name="body" rows={10} required maxLength={5000} defaultValue={initial?.body} placeholder={config.bodyPlaceholder} />
        </label>

        <div className="publish-field">
          <span>图片</span>
          <label className="upload-box">
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || attachments.length >= MAX_IMAGES} onChange={(event) => uploadFiles(event.target.files)} />
            <b>{uploading ? "上传中…" : "+ 添加图片"}</b>
            <small>JPG、PNG、WebP，单张不超过10MB，最多{MAX_IMAGES}张</small>
          </label>
          {attachments.length > 0 && (
            <div className="uploaded-images">
              {attachments.map((attachment) => (
                <img
                  key={attachment.id}
                  src={`/api/uploads/${attachment.id}`}
                  alt={attachment.fileName}
                  loading="lazy"
                />
              ))}
            </div>
          )}
          {uploadError && <small className="auth-field-error">{uploadError}</small>}
        </div>

        <fieldset className="publish-fieldset">
          <legend>领域 <em>*</em> <small>可多选</small></legend>
          <div className="field-options">
            {publicInterestFields.map((field) => (
              <label key={field}>
                <input type="checkbox" name="fields" value={field} defaultChecked={initial?.fields.includes(field)} />
                <span>{field}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="publish-row">
          <label className="publish-field">
            <span>省份/地区</span>
            <select
              name="region"
              value={selectedRegion}
              onChange={(event) => {
                setSelectedRegion(event.target.value);
                setSelectedCity("");
              }}
            >
              <option value="">全国 / 不限</option>
              {provinceOptions.map((province) => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
          </label>
          <label className="publish-field">
            <span>城市</span>
            <select
              name="city"
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
            >
              <option value="">{selectedRegion ? "不限 / 请选择" : "请先选择省份"}</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>
        </div>

        <TextField name="tags" label="话题" defaultValue={initial?.tags.join("，")} placeholder="多个话题用逗号分隔" />

        {moduleSlug === "updates" && (
          <>
            <fieldset className="publish-fieldset">
              <legend>联系方式 <em>*</em> <small>至少填写一项，仅注册用户点击“搭把手”后可见</small></legend>
              <div className="publish-row">
                <TextField name="contactPhone" label="手机号码" type="tel" defaultValue={metadata.contactPhone || defaultContact.phone} placeholder="请输入常用手机号码" />
                <TextField name="contactWechat" label="微信号" defaultValue={metadata.contactWechat || defaultContact.wechat} placeholder="请输入微信号" />
              </div>
              <small className="contact-autofill-note">保存后会绑定到账号，下次发布时自动带出，你仍可修改。</small>
            </fieldset>
            <div className="publish-row">
              <TextField name="periodStart" label="开始日期" type="date" defaultValue={metadata.periodStart} />
              <TextField name="periodEnd" label="结束日期" type="date" defaultValue={metadata.periodEnd} />
              <TextField name="relatedLinks" label="相关报道链接" defaultValue={metadata.relatedLinks} placeholder="最多5条，换行分隔" />
            </div>
          </>
        )}

        {moduleSlug === "funding" && (
          <div className="publish-specific-grid">
            <TextField name="amount" label="金额/折算价值" defaultValue={metadata.amount} placeholder="如：20万元" />
            <TextField name="validUntil" label="截止日期" type="date" defaultValue={metadata.validUntil} />
            <TextField name="applicationUrl" label="申请地址" defaultValue={metadata.applicationUrl} placeholder="官网报名页或登记表链接" />
            <TextField name="requirements" label="申请要求" defaultValue={metadata.requirements} placeholder="主体资质及其他要求" />
            <TextField name="contactName" label="联系人" defaultValue={metadata.contactName} />
            <TextField name="contactEmail" label="联系邮箱" type="email" defaultValue={metadata.contactEmail} />
            <TextField name="contactPhone" label="联系电话" defaultValue={metadata.contactPhone} />
            <TextField name="contactWechat" label="联系微信" defaultValue={metadata.contactWechat} />
          </div>
        )}

        {moduleSlug === "jobs" && (
          <div className="publish-specific-grid">
            <TextField name="headcount" label="招聘人数" type="number" defaultValue={metadata.headcount} />
            <TextField name="workMode" label="工作地点/远程" defaultValue={metadata.workMode} placeholder="如：北京朝阳 / 支持远程" />
            <TextField name="salaryMin" label="最低薪资" type="number" defaultValue={metadata.salaryMin} />
            <TextField name="salaryMax" label="最高薪资" type="number" defaultValue={metadata.salaryMax} />
            <TextField name="education" label="学历要求" defaultValue={metadata.education} placeholder="如确有必要再填写" />
            <TextField name="experience" label="经验要求" defaultValue={metadata.experience} />
            <TextField name="requirementsText" label="任职要求" defaultValue={metadata.requirementsText} />
            <TextField name="benefits" label="福利" defaultValue={metadata.benefits} />
            <TextField name="applicationEmail" label="投递邮箱" type="email" defaultValue={metadata.applicationEmail} />
            <TextField name="applicationLink" label="投递链接" defaultValue={metadata.applicationLink} />
            <TextField name="deadline" label="截止日期" type="date" defaultValue={metadata.deadline} />
          </div>
        )}

        {moduleSlug === "tools" && (
          <div className="publish-specific-grid">
            <label className="publish-field">
              <span>获取方式</span>
              <select name="priceType" defaultValue={metadata.priceType || "免费"}>
                <option>免费</option><option>商业付费</option>
              </select>
            </label>
            <TextField name="price" label="价格" defaultValue={metadata.price} placeholder="收费内容必须明示价格" />
            <TextField name="provider" label="作者/提供方" defaultValue={metadata.provider} />
            <TextField name="relatedLinks" label="相关链接" defaultValue={metadata.relatedLinks} placeholder="最多3条，换行分隔" />
            <label className="publish-confirm"><input type="checkbox" name="copyrightConfirmed" value="true" defaultChecked={metadata.copyrightConfirmed === "true"} required /> 我确认拥有内容版权或已获得合法授权</label>
          </div>
        )}

        {state.fieldErrors && (
          <div className="publish-errors">
            {Object.values(state.fieldErrors).flat().map((error) => <span key={error}>{error}</span>)}
          </div>
        )}

        <div className="publish-actions">
          <Link href="/account/content" className="btn-ghost">取消</Link>
          <button type="submit" name="intent" value="draft" className="btn-ghost" formNoValidate disabled={isSavingDraft || isSubmitting || uploading}>{isSavingDraft ? "保存中…" : "保存草稿"}</button>
          <button type="button" className="btn-ghost" onClick={showPreview}>预览</button>
          <button type="submit" name="intent" value="submit" className="btn-primary" disabled={isSubmitting || isSavingDraft || uploading}>{isSubmitting ? "发布中…" : "发布"}</button>
        </div>
      </form>

      {preview && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="内容预览">
          <article className="modal publish-preview">
            <div className="modal-head"><h2>内容预览</h2><button type="button" className="modal-close" onClick={() => setPreview(null)}>✕</button></div>
            <span className="tag tag-green">{preview.subtype}</span>
            <h2>{preview.title || "未填写标题"}</h2>
            {preview.summary && <p className="preview-summary">{preview.summary}</p>}
            <p className="preview-body">{preview.body || "未填写正文"}</p>
            <div className="card-meta">📍 {[preview.region, preview.city].filter(Boolean).join(" · ") || "全国"}</div>
          </article>
        </div>
      )}
    </>
  );
}
