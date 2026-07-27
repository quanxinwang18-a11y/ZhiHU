export function DistillationPreview({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <section
      className="distillation-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="distillation-title"
    >
      <button
        type="button"
        className="distillation-close"
        onClick={onClose}
        aria-label="返回视角封印"
        autoFocus
      >
        ×
      </button>

      <div className="distillation-field" aria-hidden="true">
        <i className="distillation-axis" />
        <div className="distillation-stream stream-left">
          {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
        </div>
        <div className="distillation-stream stream-right">
          {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
        </div>
        <span className="distillation-seal" />
      </div>

      <div className="distillation-copy">
        <p>PERSONA DISTILLATION</p>
        <h2 id="distillation-title">蒸馏</h2>
        <span>功能开发中</span>
        <button type="button" onClick={onClose}>
          返回视角封印
        </button>
      </div>
    </section>
  );
}
