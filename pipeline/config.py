"""Central config: env keys, model ids, and the category color scheme.

Loaded once and shared by all pipeline stages. Keys come from the project .env
(CHANDRA_OCR_API_KEY for Datalab, OPENAI_API_KEY for the reasoning model).
"""
import os
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

DATALAB_API_KEY = os.environ.get("CHANDRA_OCR_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# Stage ② reasoning model (contract extraction). Single source of truth; env-overridable
# so prod can change the model/effort without a code change (e.g. Cloud Run REASONER_MODEL env).
REASONER_MODEL = os.environ.get("REASONER_MODEL", "gpt-5.4-mini")
REASONER_EFFORT = os.environ.get("REASONER_EFFORT", "medium")

# Autoresearch rule-proposer model (dev-time optimization tool, not the serving path).
# Kept on a strong model for quality rule generation; still env-overridable.
RESEARCHER_MODEL = os.environ.get("RESEARCHER_MODEL", "gpt-5.5")
RESEARCHER_EFFORT = os.environ.get("RESEARCHER_EFFORT", "high")

# Category -> RGB color (annotation boxes). One hue per breakdown category (§7 of the design).
CATEGORY_COLORS = {
    "Identity":      (99, 110, 250),    # indigo
    "Customer":      (84, 110, 122),    # slate
    "Platform Fee":  (0, 160, 136),     # teal
    "Hosting":  (255, 140, 0),     # orange
    "LLM Usage":     (156, 39, 176),    # purple
    "Credit Grant":  (46, 125, 50),     # green
    "Entitlement":   (3, 155, 229),     # sky
    "Override":      (216, 27, 96),     # magenta/pink
    "Commitment":    (211, 47, 47),     # red
    "Terms":         (109, 76, 65),     # brown
    "Other":         (120, 120, 120),   # gray
}
DEFAULT_COLOR = (120, 120, 120)

# Datalab OCR renders pages at 96 DPI (image_bbox space). We render at RENDER_DPI
# and scale OCR boxes by RENDER_DPI/96.
OCR_DPI = 96
RENDER_DPI = 144
