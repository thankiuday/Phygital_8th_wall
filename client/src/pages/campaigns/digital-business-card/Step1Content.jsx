import React, { useRef, useState } from 'react';
import { Plus, Trash2, ImagePlus, GripVertical, Upload as UploadIcon } from 'lucide-react';

import { campaignService } from '../../../services/campaignService';
import { SECTION_TYPES, SOCIAL_PLATFORMS } from '../../../components/card/cardTemplates';

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
    const images = section.images || [];
    const onPickImages = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const next = [...images];
      for (const f of files) {
        try {
          const up = await campaignService.uploadToCloudinary(f, 'image');
          next.push({ url: up.url, publicId: up.publicId });
        } catch {/* swallow individual upload failures */}
      }
      handleField('images', next);
    };
    return (
      <div className="space-y-2">
        <input
          type="text"
          className="form-input"
          placeholder="Gallery title (e.g. My professional pictures)"
          value={section.title || ''}
          onChange={(e) => handleField('title', e.target.value)}
        />
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--text-secondary)] hover:border-brand-500/50">
          <ImagePlus size={14} />
          Add photos
          <input type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} />
        </label>
        {images.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {images.map((img, idx) => (
              <div key={img.publicId || idx} className="group relative aspect-square overflow-hidden rounded-lg">
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleField('images', images.filter((_, i) => i !== idx))}
                  className="absolute right-1 top-1 hidden rounded-md bg-black/70 p-1 text-white group-hover:block"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (section.type === 'video') {
    const onPickVideo = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const up = await campaignService.uploadToCloudinary(f, 'video');
        handleField('source', 'upload');
        handleField('videoUrl', up.url);
        handleField('publicId', up.publicId);
        handleField('thumbnailUrl', up.thumbnailUrl);
      } catch {/* ignore */}
    };
    return (
      <div className="space-y-2">
        <input
          type="text"
          className="form-input"
          placeholder="Video title (e.g. Company video)"
          value={section.title || ''}
          onChange={(e) => handleField('title', e.target.value)}
        />
        <input
          type="url"
          className="form-input"
          placeholder="Paste a YouTube/Vimeo URL (or upload below)"
          value={section.externalVideoUrl || ''}
          onChange={(e) => {
            handleField('source', 'link');
            handleField('externalVideoUrl', e.target.value);
          }}
        />
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--text-secondary)] hover:border-brand-500/50">
          <UploadIcon size={14} />
          Replace with upload
          <input type="file" accept="video/*" className="hidden" onChange={onPickVideo} />
        </label>
      </div>
    );
  }
  if (section.type === 'links') {
    const items = section.items || [];
    const updateItem = (idx, patch) => handleField('items', items.map((it, i) => i === idx ? { ...it, ...patch } : it));
    return (
      <div className="space-y-2">
        <input
          type="text"
          className="form-input"
          placeholder="Section title (e.g. Useful links)"
          value={section.title || ''}
          onChange={(e) => handleField('title', e.target.value)}
        />
        {items.map((it, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              className="form-input flex-1"
              placeholder="Label"
              value={it.label || ''}
              onChange={(e) => updateItem(idx, { label: e.target.value })}
            />
            <input
              type="url"
              className="form-input flex-[1.5]"
              placeholder="https://"
              value={it.url || ''}
              onChange={(e) => updateItem(idx, { url: e.target.value })}
            />
            <button
              type="button"
              onClick={() => handleField('items', items.filter((_, i) => i !== idx))}
              className="rounded-lg border border-[var(--border-color)] px-2 text-[var(--text-muted)] hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => handleField('items', [...items, { label: '', url: '' }])}
          className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300"
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
      <div className="space-y-2">
        <input
          type="text"
          className="form-input"
          placeholder="Section title (e.g. What clients say)"
          value={section.title || ''}
          onChange={(e) => handleField('title', e.target.value)}
        />
        {items.map((it, idx) => (
          <div key={idx} className="space-y-1 rounded-lg border border-[var(--border-color)] p-2">
            <textarea
              rows={2}
              className="form-input"
              placeholder="Quote"
              value={it.quote || ''}
              onChange={(e) => updateItem(idx, { quote: e.target.value })}
            />
            <div className="flex gap-2">
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
                className="rounded-lg border border-[var(--border-color)] px-2 text-[var(--text-muted)] hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => handleField('items', [...items, { quote: '', author: '', role: '' }])}
          className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300"
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
    store.addSection(base);
  };

  const trimmed = (c.fullName || '').trim();
  const canContinue = trimmed.length > 0;

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
        <section className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Profile Images</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Profile photo</label>
              <button
                type="button"
                onClick={() => profileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] py-6 text-xs text-[var(--text-secondary)] hover:border-brand-500/50"
              >
                {(c.profileImageUrl || c.profileImagePreview) ? (
                  <img src={c.profileImagePreview || c.profileImageUrl} alt="profile" className="h-16 w-16 rounded-full object-cover" />
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
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] py-6 text-xs text-[var(--text-secondary)] hover:border-brand-500/50"
              >
                {(c.bannerImageUrl || c.bannerImagePreview) ? (
                  <img src={c.bannerImagePreview || c.bannerImageUrl} alt="banner" className="h-16 w-32 rounded-md object-cover" />
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
        <section className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Profile Info</h4>
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
        <section className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Contact Info</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="tel" className="form-input" placeholder="Phone" value={c.contact?.phone || ''} onChange={(e) => store.patchContact({ phone: e.target.value })} />
            <input type="email" className="form-input" placeholder="Email" value={c.contact?.email || ''} onChange={(e) => store.patchContact({ email: e.target.value })} />
            <input type="tel" className="form-input" placeholder="WhatsApp number" value={c.contact?.whatsapp || ''} onChange={(e) => store.patchContact({ whatsapp: e.target.value })} />
            <input type="url" className="form-input" placeholder="Website" value={c.contact?.website || ''} onChange={(e) => store.patchContact({ website: e.target.value })} />
            <input type="text" className="form-input sm:col-span-2" placeholder="Address (optional)" value={c.address || ''} onChange={(e) => store.patchContent({ address: e.target.value })} />
          </div>
        </section>

        {/* Socials */}
        <section className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Social Links</h4>
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
        <section className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Sections</h4>
            <div className="flex flex-wrap gap-2">
              {SECTION_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => addSection(t.id)}
                  className="rounded-md border border-[var(--border-color)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-300"
                >
                  + {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {(c.sections || []).map((sec, idx) => (
              <div key={sec.id} className="space-y-2 rounded-lg border border-[var(--border-color)] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <GripVertical size={12} />
                    {SECTION_TYPES.find((t) => t.id === sec.type)?.label || sec.type}
                  </div>
                  <div className="flex items-center gap-1">
                    {idx > 0 && (
                      <button type="button" onClick={() => store.reorderSections(idx, idx - 1)} className="rounded p-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">↑</button>
                    )}
                    {idx < (c.sections.length - 1) && (
                      <button type="button" onClick={() => store.reorderSections(idx, idx + 1)} className="rounded p-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">↓</button>
                    )}
                    <button
                      type="button"
                      onClick={() => store.removeSection(sec.id)}
                      className="rounded p-1 text-xs text-[var(--text-muted)] hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <SectionEditor section={sec} onUpdate={store.updateSection} onRemove={store.removeSection} />
              </div>
            ))}
            {(!c.sections || !c.sections.length) && (
              <p className="text-xs text-[var(--text-muted)]">No sections yet. Add one above to enrich your card.</p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Design
        </button>
      </div>
    </div>
  );
};

export default Step1Content;
