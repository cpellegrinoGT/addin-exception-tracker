import { ProgressBar } from "@geotab/zenith";

interface LoadingOverlayProps {
  visible: boolean;
  text: string;
  progress: number;
}

export default function LoadingOverlay({ visible, text, progress }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fut-loading-overlay">
      <div className="fut-loading-content">
        <span className="fut-loading-text">{text}</span>
        <div className="fut-progress-wrap">
          <ProgressBar now={progress} min={0} max={100} size="medium" />
        </div>
      </div>
    </div>
  );
}
