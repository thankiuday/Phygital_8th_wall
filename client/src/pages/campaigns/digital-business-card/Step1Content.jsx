import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Trash2, ImagePlus, GripVertical, Upload as UploadIcon, Loader2, Video as VideoIcon } from 'lucide-react';

import { campaignService } from '../../../services/campaignService';
import { resolveCardImageUrl, resolvePlaybackMediaUrl } from '../../../utils/assetUrl';
import { SECTION_TYPES, SOCIAL_PLATFORMS } from '../../../components/card/cardTemplates';

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const SectionAddToolbar = ({ onAdd, label = 'Add section', className = '' }) => (
  <div className={className}>
    <p className="mb-2 text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
    <div className="flex flex-wrap gap-2">
      {SECTION_TYPES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onAdd(t.id)}
          className="wizard-btn-secondary px-2.5 py-1.5 text-xs"
        >
          + {t.label}
        </button>
      ))}
    </div>
  </div>
);

const ImageGallerySectionEditor = ({ section, onUpdate }) => {
  const fileInputRef = useRef(null);
  const imagesRef = useRef(section.images || []);
  const [pending, setPending] = useState([]);

  const images = section.images || [];
  const isUploading = pending.length > 0;

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const handleField = (key, value) => onUpdate(section.id, { [key]: value });

  const appendImages = (newOnes) => {
    if (!newOnes.length) return;
    const next = [...imagesRef.current, ...newOnes];
    imagesRef.current = next;
    handleField('images', next);
  };

  const removePending = (id) => {
    setPending((items) => {
      const item = items.find((x) => x.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return items.filter((x) => x.id !== id);
    });
  };

  const onPickImages = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const batch = files.map((file) => ({
      id: newId(),
      preview: URL.createObjectURL(file),
      progress: 0,
      error: null,
      file,
    }));
    setPending((p) => [...p, ...batch]);

    const uploaded = [];
    await Promise.all(
      batch.map(async (item) => {
        try {
          const up = await campaignService.uploadToCloudinary(
            item.file,
            'image',
            (pct) => {
              setPending((p) => p.map((x) => (x.id === item.id ? { ...x, progress: pct } : x)));
            },
          );
          uploaded.push({ url: up.url, publicId: up.publicId });
          URL.revokeObjectURL(item.preview);
          setPending((p) => p.filter((x) => x.id !== item.id));
        } catch {
          setPending((p) => p.map((x) => (
            x.id === item.id ? { ...x, error: 'Upload failed', progress: 0 } : x
          )));
        }
      }),
    );

    appendImages(uploaded);
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        className="form-input"
        placeholder="Gallery title (e.g. My professional pictures)"
        value={section.title || ''}
        onChange={(e) => handleField('title', e.target.value)}
      />
      <button
        type="button"
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--text-secondary)] hover:border-brand-500/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUploading ? (
          <>
            <Loader2 size={14} className="animate-spin text-brand-400" />
            Uploading {pending.filter((p) => !p.error).length} photo{pending.filter((p) => !p.error).length === 1 ? '' : 's'}…
          </>
        ) : (
          <>
            <ImagePlus size={14} />
            Add photos
          </>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPickImages}
      />
      {(images.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, idx) => (
            <div key={img.publicId || img.url || idx} className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border-color)]">
              <img src={resolvePlaybackMediaUrl(img.url)} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleField('images', images.filter((_, i) => i !== idx))}
                className="absolute right-1 top-1 hidden rounded-md bg-black/70 p-1 text-white group-hover:block"
                aria-label="Remove photo"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {pending.map((item) => (
            <div
              key={item.id}
              className={`relative aspect-square overflow-hidden rounded-lg border ${
                item.error ? 'border-red-500/60' : 'border-brand-500/40'
              }`}
            >
              <img src={item.preview} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 p-1 text-center">
                {item.error ? (
                  <>
                    <span className="text-[10px] font-medium text-red-300">{item.error}</span>
                    <button
                      type="button"
                      onClick={() => removePending(item.id)}
                      className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white"
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span className="font-mono text-[10px] font-semibold text-white">
                      {item.progress > 0 ? `${item.progress}%` : 'Starting…'}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VideoSectionEditor = ({ section, onUpdate }) => {
  const fileInputRef = useRef(null);
  const [pending, setPending] = useState(null);

  const isUploading = Boolean(pending && !pending.error);
  const hasUpload = section.source === 'upload' && (section.videoUrl || section.url);
  const thumbUrl = section.thumbnailUrl
    ? resolvePlaybackMediaUrl(section.thumbnailUrl)
    : (hasUpload && section.videoUrl ? resolvePlaybackMediaUrl(section.videoUrl) : null);

  const patchSection = (patch) => onUpdate(section.id, patch);

  const clearPending = () => {
    if (pending?.preview) URL.revokeObjectURL(pending.preview);
    setPending(null);
  };

  const onPickVideo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setPending({ preview, progress: 0, error: null, fileName: file.name });

    try {
      const up = await campaignService.uploadToCloudinary(
        file,
        'video',
        (pct) => setPending((p) => (p ? { ...p, progress: pct } : p)),
      );
      URL.revokeObjectURL(preview);
      setPending(null);
      patchSection({
        source: 'upload',
        videoUrl: up.url,
        url: up.url,
        publicId: up.publicId,
        thumbnailUrl: up.thumbnailUrl || null,
        externalVideoUrl: '',
      });
    } catch {
      setPending((p) => (p ? { ...p, error: 'Upload failed', progress: 0 } : p));
    }
  };

  const clearUpload = () => {
    patchSection({
      source: 'link',
      videoUrl: undefined,
      url: undefined,
      publicId: undefined,
      thumbnailUrl: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        className="form-input"
        placeholder="Video title (e.g. Company video)"
        value={section.title || ''}
        onChange={(e) => patchSection({ title: e.target.value })}
      />
      <input
        type="url"
        className="form-input"
        placeholder="Paste a YouTube/Vimeo URL (or upload below)"
        value={section.externalVideoUrl || ''}
        disabled={isUploading}
        onChange={(e) => {
          patchSection({
            source: 'link',
            externalVideoUrl: e.target.value,
            videoUrl: undefined,
            url: undefined,
            publicId: undefined,
            thumbnailUrl: undefined,
          });
        }}
      />
      <button
        type="button"
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--text-secondary)] hover:border-brand-500/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUploading ? (
          <>
            <Loader2 size={14} className="animate-spin text-brand-400" />
            Uploading video… {pending.progress > 0 ? `${pending.progress}%` : ''}
          </>
        ) : (
          <>
            <UploadIcon size={14} />
            {hasUpload ? 'Replace with upload' : 'Upload video'}
          </>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.m4v"
        className="hidden"
        onChange={onPickVideo}
      />

      {pending && (
        <div className={`relative overflow-hidden rounded-xl border ${pending.error ? 'border-red-500/60' : 'border-brand-500/40'}`}>
          <video
            src={pending.preview}
            className="aspect-video w-full bg-black object-contain"
            muted
            playsInline
            preload="metadata"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 p-3 text-center">
            {pending.error ? (
              <>
                <span className="text-xs font-medium text-red-300">{pending.error}</span>
                <button
                  type="button"
                  onClick={clearPending}
                  className="rounded-md bg-black/60 px-3 py-1 text-xs text-white"
                >
                  Dismiss
                </button>
              </>
            ) : (
              <>
                <Loader2 size={22} className="animate-spin text-white" />
                <span className="max-w-full truncate text-xs text-white/90">{pending.fileName}</span>
                <span className="font-mono text-xs font-semibold text-white">
                  {pending.progress > 0 ? `${pending.progress}%` : 'Starting…'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {!pending && hasUpload && (
        <div className="group relative overflow-hidden rounded-xl border border-[var(--border-color)]">
          {thumbUrl ? (
            <img src={thumbUrl} alt="Video thumbnail" className="aspect-video w-full bg-black object-cover" />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-[var(--surface-3)] text-[var(--text-muted)]">
              <VideoIcon size={28} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
            <p className="truncate text-xs text-white">Uploaded video ready</p>
          </div>
          <button
            type="button"
            onClick={clearUpload}
            className="absolute right-2 top-2 hidden rounded-md bg-black/70 p-1.5 text-white group-hover:block"
            aria-label="Remove uploaded video"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

const SectionEditor = ({ section, onUpdate, onRemove }) => {
  const handleField = (key, value) => onUpdate(section.id, { [key]: value });

  if (section.type === 'heading') {
    return (
      <input
        type="text"
        className="form-input"
        placeholder="Heading text"
        value={section.text || ''}
        onChange={(e) => handleField('text', e.target.value)}
      />
    );
  }
  if (section.type === 'text' || section.type === 'about') {
    return (
      <div className="space-y-2">
        <input
          type="text"
          className="form-input"
          placeholder={section.type === 'about' ? 'About title (e.g. About us)' : 'Title (optional)'}
          value={section.title || ''}
          onChange={(e) => handleField('title', e.target.value)}
        />
        <textarea
          rows={3}
          className="form-input"
          placeholder="Body"
          value={section.body || ''}
          onChange={(e) => handleField('body', e.target.value)}
        />
      </div>
    );
  }
  if (section.type === 'imageGallery') {
    return <ImageGallerySectionEditor section={section} onUpdate={onUpdate} />;
  }
  if (section.type === 'video') {
    return <VideoSectionEditor section={section} onUpdate={onUpdate} />;
  }
  if (section.type === 'links') {
    const items = section.items || [];
    const updateItem = (idx, patch) => handleField('items', items.map((it, i) => i === idx ? { ...it, ...patch } : it));
    return (
      <div className="space-y-3">
        <input
          type="text"
          className="form-input"
          placeholder="Section title (e.g. Useful links)"
          value={section.title || ''}
          onChange={(e) => handleField('title', e.target.value)}
        />
        {items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_44px]">
            <input
              type="text"
              className="form-input min-w-0"
              placeholder="Label"
              value={it.label || ''}
              onChange={(e) => updateItem(idx, { label: e.target.value })}
            />
            <input
              type="url"
              className="form-input min-w-0"
              placeholder="https://"
              value={it.url || ''}
              onChange={(e) => updateItem(idx, { url: e.target.value })}
            />
            <button
              type="button"
              onClick={() => handleField('items', items.filter((_, i) => i !== idx))}
              className="wizard-btn-secondary h-11 w-11 px-0 text-[var(--text-muted)] hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => handleField('items', [...items, { label: '', url: '' }])}
          className="wizard-btn-secondary px-3 py-2 text-xs"
        >
          <Plus size={14} />
          Add link
        </button>
      </div>
    );
  }
  if (section.type === 'testimonials') {
    const items = section.items || [];
    const updateItem = (idx, patch) => handleField('items', items.map((it, i) => i === idx ? { ...it, ...patch } : it));
    return (
      <div className="space-y-3">
        <input
          type="text"
          className="form-input"
          placeholder="Section title (e.g. What clients say)"
          value={section.title || ''}
          onChange={(e) => handleField('title', e.target.value)}
        />
        {items.map((it, idx) => (
          <div key={idx} className="space-y-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/50 p-3">
            <textarea
              rows={2}
              className="form-input"
              placeholder="Quote"
              value={it.quote || ''}
              onChange={(e) => updateItem(idx, { quote: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px]">
              <input
                type="text"
                className="form-input flex-1"
                placeholder="Author"
                value={it.author || ''}
                onChange={(e) => updateItem(idx, { author: e.target.value })}
              />
              <input
                type="text"
                className="form-input flex-1"
                placeholder="Role"
                value={it.role || ''}
                onChange={(e) => updateItem(idx, { role: e.target.value })}
              />
              <button
                type="button"
                onClick={() => handleField('items', items.filter((_, i) => i !== idx))}
                className="wizard-btn-secondary h-11 w-11 px-0 text-[var(--text-muted)] hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => handleField('items', [...items, { quote: '', author: '', role: '' }])}
          className="wizard-btn-secondary px-3 py-2 text-xs"
        >
          <Plus size={14} />
          Add testimonial
        </button>
      </div>
    );
  }
  return null;
};

const Step1Content = ({ draft, store, onContinue, onBack }) => {
  const profileInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const pendingScrollSectionIdRef = useRef(null);
  const [uploading, setUploading] = useState({ profile: false, banner: false });

  const c = draft.cardContent;

  const handleImageUpload = async (file, field) => {
    if (!file) return;
    const isProfile = field === 'profile';
    setUploading((u) => ({ ...u, [field]: true }));
    try {
      const previewKey = isProfile ? 'profileImagePreview' : 'bannerImagePreview';
      const urlKey = isProfile ? 'profileImageUrl' : 'bannerImageUrl';
      const idKey = isProfile ? 'profileImagePublicId' : 'bannerImagePublicId';
      const objectURL = URL.createObjectURL(file);
      store.patchContent({ [previewKey]: objectURL });
      const up = await campaignService.uploadToCloudinary(file, 'image');
      store.patchContent({
        [previewKey]: null,
        [urlKey]: up.url,
        [idKey]: up.publicId,
      });
    } catch (err) {
      // keep preview, surface error inline
      store.patchContent({});
    } finally {
      setUploading((u) => ({ ...u, [field]: false }));
    }
  };

  const addSection = (type) => {
    const base = { id: newId(), type };
    if (type === 'imageGallery') base.images = [];
    if (type === 'links') base.items = [];
    if (type === 'testimonials') base.items = [];
    if (type === 'video') base.source = 'link';
    pendingScrollSectionIdRef.current = base.id;
    store.addSection(base);
  };

  useLayoutEffect(() => {
    const id = pendingScrollSectionIdRef.current;
    if (!id) return;

    const scrollToSection = () => {
      const el = document.getElementById(`section-card-${id}`);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      pendingScrollSectionIdRef.current = null;
      return true;
    };

    if (!scrollToSection()) {
      requestAnimationFrame(scrollToSection);
    }
  }, [c.sections]);

  const trimmed = (c.fullName || '').trim();
  const canContinue = trimmed.length > 0;
  const profileDisplayUrl = resolveCardImageUrl(c.profileImagePreview, c.profileImageUrl);
  const bannerDisplayUrl = resolveCardImageUrl(c.bannerImagePreview, c.bannerImageUrl);

  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Content</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Profile, contact, social links, and the sections that make your card uniquely yours.
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile images */}
        <section className="wizard-section space-y-3">
          <h4 className="wizard-section-title">Profile Images</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Profile photo</label>
              <button
                type="button"
                onClick={() => profileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] py-6 text-xs text-[var(--text-secondary)] hover:border-brand-500/50"
              >
                {profileDisplayUrl ? (
                  <img src={profileDisplayUrl} alt="Profile preview" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <>
                    <ImagePlus size={16} /> Upload photo
                  </>
                )}
              </button>
              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e.target.files?.[0], 'profile')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Banner (optional)</label>
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] py-6 text-xs text-[var(--text-secondary)] hover:border-brand-500/50"
              >
                {bannerDisplayUrl ? (
                  <img src={bannerDisplayUrl} alt="Banner preview" className="h-16 w-full max-w-[8rem] rounded-md object-cover" />
                ) : (
                  <>
                    <ImagePlus size={16} /> Upload banner
                  </>
                )}
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e.target.files?.[0], 'banner')}
              />
            </div>
          </div>
        </section>

        {/* Profile info */}
        <section className="wizard-section space-y-3">
          <h4 className="wizard-section-title">Profile Info</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Full name *</label>
              <input
                type="text"
                className="form-input"
                value={c.fullName || ''}
                onChange={(e) => store.patchContent({ fullName: e.target.value })}
                maxLength={80}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Job title</label>
              <input
                type="text"
                className="form-input"
                value={c.jobTitle || ''}
                onChange={(e) => store.patchContent({ jobTitle: e.target.value })}
                maxLength={80}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Company</label>
              <input
                type="text"
                className="form-input"
                value={c.company || ''}
                onChange={(e) => store.patchContent({ company: e.target.value })}
                maxLength={80}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Tagline</label>
              <input
                type="text"
                className="form-input"
                value={c.tagline || ''}
                onChange={(e) => store.patchContent({ tagline: e.target.value })}
                maxLength={120}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Bio</label>
              <textarea
                rows={3}
                className="form-input"
                value={c.bio || ''}
                onChange={(e) => store.patchContent({ bio: e.target.value })}
                maxLength={500}
              />
            </div>
          </div>
        </section>

        {/* Contact info */}
        <section className="wizard-section space-y-3">
          <h4 className="wizard-section-title">Contact Info</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="tel" className="form-input" placeholder="Phone" value={c.contact?.phone || ''} onChange={(e) => store.patchContact({ phone: e.target.value })} />
            <input type="email" className="form-input" placeholder="Email" value={c.contact?.email || ''} onChange={(e) => store.patchContact({ email: e.target.value })} />
            <input type="tel" className="form-input" placeholder="WhatsApp number" value={c.contact?.whatsapp || ''} onChange={(e) => store.patchContact({ whatsapp: e.target.value })} />
            <input type="url" className="form-input" placeholder="Website" value={c.contact?.website || ''} onChange={(e) => store.patchContact({ website: e.target.value })} />
            <input type="text" className="form-input sm:col-span-2" placeholder="Address (optional)" value={c.contact?.address || c.address || ''} onChange={(e) => store.patchContact({ address: e.target.value })} />
          </div>
        </section>

        {/* Socials */}
        <section className="wizard-section space-y-3">
          <h4 className="wizard-section-title">Social Links</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((p) => (
              <input
                key={p}
                type="url"
                className="form-input"
                placeholder={`${p.charAt(0).toUpperCase() + p.slice(1)} URL`}
                value={c.social?.[p] || ''}
                onChange={(e) => store.patchSocial({ [p]: e.target.value })}
              />
            ))}
          </div>
        </section>

        {/* Sections */}
        <section className="wizard-section space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="wizard-section-title mb-0">Sections</h4>
            {(c.sections?.length > 0) && (
              <span className="shrink-0 text-xs text-[var(--text-muted)]">
                {c.sections.length} added
              </span>
            )}
          </div>

          <SectionAddToolbar
            onAdd={addSection}
            className="sticky top-16 z-20 -mx-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)]/95 p-3 shadow-sm backdrop-blur-md lg:top-20"
          />

          <div className="space-y-3">
            {(c.sections || []).map((sec, idx) => (
              <div
                key={sec.id}
                id={`section-card-${sec.id}`}
                className="scroll-mt-28 space-y-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/45 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <GripVertical size={12} />
                    {SECTION_TYPES.find((t) => t.id === sec.type)?.label || sec.type}
                  </div>
                  <div className="flex items-center gap-1">
                    {idx > 0 && (
                      <button type="button" onClick={() => store.reorderSections(idx, idx - 1)} className="wizard-btn-secondary h-8 w-8 px-0 text-xs">↑</button>
                    )}
                    {idx < (c.sections.length - 1) && (
                      <button type="button" onClick={() => store.reorderSections(idx, idx + 1)} className="wizard-btn-secondary h-8 w-8 px-0 text-xs">↓</button>
                    )}
                    <button
                      type="button"
                      onClick={() => store.removeSection(sec.id)}
                      className="wizard-btn-secondary h-8 w-8 px-0 text-xs text-[var(--text-muted)] hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <SectionEditor section={sec} onUpdate={store.updateSection} onRemove={store.removeSection} />
              </div>
            ))}
            {(!c.sections || !c.sections.length) && (
              <p className="text-xs text-[var(--text-muted)]">
                No sections yet. Use the buttons above to add headings, galleries, videos, and more.
              </p>
            )}
          </div>

          {(c.sections?.length > 0) && (
            <SectionAddToolbar
              onAdd={addSection}
              label="Add another section"
              className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-2)]/50 p-3"
            />
          )}
        </section>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="wizard-btn-secondary"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="wizard-btn-primary"
        >
          Continue to Design
        </button>
      </div>
    </div>
  );
};

export default Step1Content;
