/** Real writing systems, presented as a collection of field notes. */
import { fontStackFor } from '../../script/fonts';

export default function ScriptArtwork({ compact = false }) {
  return (
    <div
      className={`pe-script-art ${compact ? 'pe-script-art--compact' : ''}`}
      aria-label="Writing from around the world"
    >
      <div className="pe-script-orbit" aria-hidden="true" />
      <div className="pe-script-paper pe-script-paper--back">
        <span className="pe-paper-label">Tamil · தமிழ்</span>
        <p lang="ta" style={{ fontFamily: fontStackFor('taml') }}>
          இன்று காலை மிகவும் குளிராக இருந்தது
        </p>
        <span className="pe-paper-rule" />
      </div>
      <div className="pe-script-paper pe-script-paper--front">
        <span className="pe-paper-label">Hindi · हिन्दी</span>
        <p lang="hi" style={{ fontFamily: fontStackFor('deva') }}>
          आज सुबह
          <br />
          बहुत ठंड थी
        </p>
        <span className="pe-paper-stamp" aria-hidden="true">
          ✳
        </span>
        <span className="pe-paper-coordinate">
          “It was very cold this morning.”
        </span>
      </div>
      <div
        className="pe-script-slip"
        lang="am"
        style={{ fontFamily: fontStackFor('ethi') }}
      >
        ዛሬ ጠዋት
      </div>
    </div>
  );
}
