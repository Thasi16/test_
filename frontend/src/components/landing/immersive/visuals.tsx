import {
  BookOpen,
  Camera,
  Check,
  Hand,
  Heart,
  Route,
  Sparkles,
} from "lucide-react";

export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div className={`im-aurora ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <span className="im-grain" />
    </div>
  );
}
export type PreviewLabels = {
  brand: string;
  sample: string;
  library: string;
  hello: string;
  thanks: string;
  family: string;
  camera: string;
  mirror: string;
  cameraNote: string;
  ai: string;
  planned: string;
  aiNote: string;
};
export function LibraryPreview({
  labels,
  compact = false,
}: {
  labels: PreviewLabels;
  compact?: boolean;
}) {
  return (
    <div className="im-library-preview">
      <div className="im-preview-heading">
        <BookOpen size={19} aria-hidden="true" />
        <strong>{labels.library}</strong>
        <span className="im-window-dots" aria-hidden="true">
          •••
        </span>
      </div>
      <div className="im-library-items">
        {[labels.hello, labels.thanks, labels.family].map((label, index) => (
          <div key={label}>
            <span
              className={`im-sign-tile im-sign-${index}`}
              aria-hidden="true"
            >
              {index === 0 ? <Hand /> : index === 1 ? <Heart /> : <Route />}
            </span>
            <span>
              <strong>{label}</strong>
              {!compact && <small>{labels.sample}</small>}
            </span>
            <span className="im-small-arrow" aria-hidden="true">
              ↗
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function CameraPreview({
  labels,
  compact = false,
}: {
  labels: PreviewLabels;
  compact?: boolean;
}) {
  return (
    <div className="im-camera-preview">
      {!compact && (
        <div className="im-preview-heading">
          <Camera size={19} aria-hidden="true" />
          <strong>{labels.camera}</strong>
        </div>
      )}
      <div className="im-camera-view">
        <span className="im-scan-corner" />
        <span className="im-camera-hand" aria-hidden="true">
          <Hand strokeWidth={1} />
        </span>
        <span className="im-mirror-label">{labels.mirror}</span>
      </div>
      {!compact && <p>{labels.cameraNote}</p>}
    </div>
  );
}
export function AiPreview({ labels }: { labels: PreviewLabels }) {
  return (
    <div className="im-ai-preview">
      <span className="im-status im-status-planned">{labels.planned}</span>
      <div className="im-ai-orbit" aria-hidden="true">
        <i />
        <i />
        <span>
          <Sparkles size={38} strokeWidth={1.3} />
        </span>
      </div>
      <h4>{labels.ai}</h4>
      <p>{labels.aiNote}</p>
    </div>
  );
}
export function ProgressPreview({
  label,
  note,
}: {
  label: string;
  note?: string;
}) {
  return (
    <div className="im-progress-preview">
      <div className="im-progress-rings" aria-hidden="true">
        <span>
          <Check size={26} />
        </span>
      </div>
      <div>
        <strong>{label}</strong>
        {note && <p>{note}</p>}
      </div>
    </div>
  );
}
