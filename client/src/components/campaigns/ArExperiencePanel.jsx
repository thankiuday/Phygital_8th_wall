import { Video as VideoIcon, Sparkles, Layers, ScanLine } from 'lucide-react';
import { arEffectLabel } from '../../constants/arEffects';
import { pickCampaignImageThumbUrl, resolvePlaybackMediaUrl } from '../../utils/assetUrl';
import DownloadPrintCardButton from './DownloadPrintCardButton';
import PrintCardPreview from './PrintCardPreview';
import SectionCard from './SectionCard';

const ArExperiencePanel = ({ campaign, arProduct }) => {
  const assetNoun = arProduct?.assetNoun || 'marker';
  const imageTargetOn = campaign.requiresImageTarget !== false;

  return (
    <div className="space-y-4 sm:space-y-5">
      <SectionCard
        icon={imageTargetOn ? ScanLine : Layers}
        iconClassName={imageTargetOn ? 'text-brand-400' : 'text-violet-400'}
        title="AR tracking mode"
        badge={(
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            imageTargetOn
              ? 'border-brand-500/25 bg-brand-500/10 text-brand-300'
              : 'border-violet-500/25 bg-violet-500/10 text-violet-300'
          }`}
          >
            {imageTargetOn ? 'Image target' : 'Surface only'}
          </span>
        )}
        description={
          imageTargetOn
            ? 'Visitors scan your printed marker before the hologram plays. Toggle off from Edit or the campaign card for surface placement.'
            : 'Visitors place the hologram on a flat surface without a printed marker. Available on Android today; iOS support is coming soon.'
        }
      />

      {imageTargetOn && campaign.targetImageUrl && (
        <SectionCard
          icon={Sparkles}
          title={`Print-ready ${assetNoun} (with QR)`}
          badge={(
            <span className="rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-300">
              AR marker
            </span>
          )}
          description={`This is the image MindAR tracks and what you print on your physical ${assetNoun}. The QR opens your AR experience when scanned.`}
        >
          <PrintCardPreview
            imageUrl={campaign.targetImageUrl}
            alt={`Print-ready ${assetNoun} with QR`}
          />
          <DownloadPrintCardButton campaign={campaign} className="mt-4 w-full sm:w-auto" />
        </SectionCard>
      )}

      {campaign.videoUrl && (
        <SectionCard
          icon={VideoIcon}
          title="Hologram video · Android & desktop"
          badge={(
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              .webm
            </span>
          )}
          description="Transparent WebM played on Android and most desktop browsers when the target is detected."
        >
          <video
            src={resolvePlaybackMediaUrl(campaign.videoUrl)}
            poster={pickCampaignImageThumbUrl(campaign) || undefined}
            controls
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            className="mx-auto max-h-72 w-full max-w-sm rounded-xl border border-[var(--border-color)] object-contain bg-black/40"
          />
        </SectionCard>
      )}

      <SectionCard
        icon={VideoIcon}
        title="Hologram video · iPhone"
        badge={(
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            side-by-side .mov
          </span>
        )}
        description="Required for iOS Safari — RGB on the left, alpha mask on the right. Without it, iPhone visitors see a black background."
      >
        {campaign.videoUrlIos ? (
          <video
            src={resolvePlaybackMediaUrl(campaign.videoUrlIos)}
            controls
            muted
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            className="mx-auto aspect-[18/16] max-h-72 w-full max-w-sm rounded-xl border border-[var(--border-color)] object-contain bg-black/40"
          />
        ) : (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200 sm:text-sm">
            Not uploaded yet — use <strong>Edit</strong> to add the side-by-side .mov export for iPhone visitors.
          </p>
        )}
      </SectionCard>

      <SectionCard
        icon={Sparkles}
        iconClassName="text-fuchsia-400"
        title="AR hologram effect"
        badge={(
          <span className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300">
            {arEffectLabel(campaign.arEffect)}
          </span>
        )}
        description="Animated effect at the base of the hologram when the target lies flat on a surface. Change it from Edit → AR effect."
      />
    </div>
  );
};

export default ArExperiencePanel;
