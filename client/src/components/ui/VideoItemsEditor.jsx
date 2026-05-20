import { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Plus, Trash2, UploadCloud, Video as VideoIcon } from 'lucide-react';
import FormInput from './FormInput';
import FileDropZone from './FileDropZone';
import UploadProgress from './UploadProgress';
import { campaignService } from '../../services/campaignService';
import {
  createVideoSlot,
  isVideoSlotReady,
  MAX_VIDEO_SLOTS,
  labelFromFileName,
} from '../../pages/campaigns/links-doc-video/linksDocVideoFormUtils';
import { isAllowedVideoHost, toEmbedSrc } from '../../utils/videoEmbed';

const ACCEPTED_VIDEO_TYPES = 'video/*,.mp4,.webm,.mov,.m4v';
const MAX_VIDEO_MB = 100;

const SourceTab = ({ active, onClick, Icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
      active
        ? 'border-brand-500/60 bg-brand-500/15 text-brand-300'
        : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-brand-500/40'
    }`}
  >
    <Icon size={15} />
    {label}
  </button>
);

const validateVideoFile = (file) =>
  new Promise((resolve) => {
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
      return resolve('Only MP4, WebM, and MOV videos are accepted.');
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > 60) {
        resolve('Video must be at most 60 seconds.');
      } else if (video.duration < 1) {
        resolve('Video appears empty.');
      } else {
        resolve(null);
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };
    video.src = URL.createObjectURL(file);
  });

/**
 * VideoItemsEditor — up to MAX_VIDEO_SLOTS videos for links-doc-video-qr edits.
 */
const VideoItemsEditor = ({
  videoSource,
  onVideoSourceChange,
  slots,
  setSlots,
  error,
  onUploadingChange,
}) => {
  const [rowErrors, setRowErrors] = useState({});
  const [uploadingUid, setUploadingUid] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const localPreviewRefs = useRef({});

  useEffect(() => () => {
    Object.values(localPreviewRefs.current || {}).forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* ignore */
      }
    });
  }, []);

  useEffect(() => {
    onUploadingChange?.(!!uploadingUid);
  }, [uploadingUid, onUploadingChange]);

  const embedOk = useMemo(() => ({
    test: (raw) => {
      const url = String(raw || '').trim();
      if (!url) return false;
      return !!(isAllowedVideoHost(url) && toEmbedSrc(url));
    },
  }), []);

  const updateSlot = (uid, patch) => {
    setSlots((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
    setRowErrors((prev) => ({ ...prev, [uid]: '' }));
  };

  const removeSlot = (uid) => {
    const prev = localPreviewRefs.current[uid];
    if (prev) URL.revokeObjectURL(prev);
    delete localPreviewRefs.current[uid];
    setSlots((s) => s.filter((row) => row.uid !== uid));
  };

  const handleUploadForRow = async (uid, file) => {
    setRowErrors((p) => ({ ...p, [uid]: '' }));
    const msg = await validateVideoFile(file);
    if (msg) {
      setRowErrors((p) => ({ ...p, [uid]: msg }));
      return;
    }
    const prev = localPreviewRefs.current[uid];
    if (prev) URL.revokeObjectURL(prev);
    const localPreview = URL.createObjectURL(file);
    localPreviewRefs.current[uid] = localPreview;

    setSlots((old) =>
      old.map((s) =>
        s.uid === uid
          ? {
              ...s,
              uploadUrl: '',
              uploadPublicId: '',
              uploadThumbnailUrl: '',
              externalUrl: '',
            }
          : s,
      ),
    );

    setUploadingUid(uid);
    setUploadProgress(0);
    try {
      const uploaded = await campaignService.uploadToCloudinary(file, 'video', (p) =>
        setUploadProgress(p),
      );
      setSlots((prev) => {
        const current = prev.find((s) => s.uid === uid);
        const nextLabel =
          (current?.label || '').trim()
          || (file.name ? labelFromFileName(file.name) : '');
        return prev.map((s) =>
          s.uid === uid
            ? {
                ...s,
                uploadUrl: uploaded.url,
                uploadPublicId: uploaded.publicId,
                uploadThumbnailUrl: uploaded.thumbnailUrl || '',
                label: nextLabel,
              }
            : s,
        );
      });
      setUploadProgress(100);
    } catch {
      setRowErrors((p) => ({ ...p, [uid]: 'Upload failed — try again.' }));
      URL.revokeObjectURL(localPreview);
      delete localPreviewRefs.current[uid];
    } finally {
      setUploadingUid(null);
    }
  };

  const addRow = () => {
    setSlots((prev) => {
      if (prev.length >= MAX_VIDEO_SLOTS) return prev;
      return [...prev, createVideoSlot()];
    });
  };

  return (
    <div className="space-y-4 border-t border-[var(--border-color)] pt-5">
      <div>
        <p className="text-xs font-medium text-[var(--text-secondary)]">Hero videos</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Up to {MAX_VIDEO_SLOTS} videos. Removing a row deletes that upload after you save when possible.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SourceTab
          active={videoSource === 'upload'}
          onClick={() => onVideoSourceChange('upload')}
          Icon={UploadCloud}
          label="Upload videos"
        />
        <SourceTab
          active={videoSource === 'link'}
          onClick={() => onVideoSourceChange('link')}
          Icon={Link2}
          label="Paste video links"
        />
      </div>

      <div className="space-y-4">
        {slots.map((slot, index) => (
          <div
            key={slot.uid}
            className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                Video {index + 1}
                {isVideoSlotReady(slot, videoSource) && (
                  <span className="ml-2 font-medium text-emerald-400">Ready</span>
                )}
              </span>
              {slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSlot(slot.uid)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400"
                  aria-label={`Remove video ${index + 1}`}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <FormInput
              label="Label"
              value={slot.label}
              onChange={(e) => updateSlot(slot.uid, { label: e.target.value })}
              maxLength={80}
              containerClassName="mb-3"
            />

            {videoSource === 'upload' ? (
              uploadingUid === slot.uid ? (
                <UploadProgress progress={uploadProgress} label={`Uploading your video (${index + 1})…`} />
              ) : (
                <FileDropZone
                  accept={ACCEPTED_VIDEO_TYPES}
                  acceptLabel="MP4, WebM, MOV"
                  maxSizeMB={MAX_VIDEO_MB}
                  onFile={(f) => handleUploadForRow(slot.uid, f)}
                  previewUrl={
                    localPreviewRefs.current[slot.uid]
                    || slot.uploadThumbnailUrl
                    || slot.uploadUrl
                  }
                  previewType="video"
                  onClear={
                    slot.uploadUrl
                      ? () => {
                          updateSlot(slot.uid, {
                            uploadUrl: '',
                            uploadPublicId: '',
                            uploadThumbnailUrl: '',
                          });
                        }
                      : undefined
                  }
                  error={rowErrors[slot.uid]}
                  icon={VideoIcon}
                  hint="Max 60s · max 100 MB"
                />
              )
            ) : (
              <>
                <FormInput
                  label="Video URL (YouTube, Vimeo, Facebook)"
                  value={slot.externalUrl}
                  onChange={(e) =>
                    updateSlot(slot.uid, {
                      externalUrl: e.target.value,
                      uploadUrl: '',
                      uploadPublicId: '',
                    })
                  }
                  placeholder="https://youtube.com/watch?v=…"
                  error={
                    slot.externalUrl?.trim()
                    && !embedOk.test(slot.externalUrl)
                      ? 'Use a supported YouTube, Vimeo, or Facebook URL'
                      : rowErrors[slot.uid]
                  }
                />
              </>
            )}
          </div>
        ))}
      </div>

      {slots.length < MAX_VIDEO_SLOTS && (
        <button
          type="button"
          onClick={addRow}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] px-4 py-2 text-sm font-medium text-brand-400 transition hover:border-brand-500/50"
        >
          <Plus size={16} /> Add another video ({slots.length}/{MAX_VIDEO_SLOTS})
        </button>
      )}

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
};

export default VideoItemsEditor;
