import argparse
import os
import glob
import logging
import sys
import subprocess
from pathlib import Path
from .extractors.pptx_extractor import PptxExtractor
from .generators.site_generator import SiteGenerator

def setup_logging(verbose=False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format='%(asctime)s - %(levelname)s - %(message)s')

def _find_unified_extractor_root() -> Path | None:
    """Locate ppt-archive/tools for unified_extractor if present."""
    try:
        here = Path(__file__).resolve()
        repo_root = here.parents[3]
    except IndexError:
        return None

    candidate = repo_root / "ppt-archive" / "tools"
    if candidate.exists():
        return candidate
    return None


def _run_unified_extractor(args, logger) -> bool:
    """Run unified_extractor CLI via subprocess. Returns True on success."""
    tools_root = _find_unified_extractor_root()
    if not tools_root:
        logger.warning("Unified extractor not found (ppt-archive/tools missing).")
        return False

    input_path = Path(args.input)
    output_path = Path(args.output)

    cmd = [
        sys.executable,
        "-m",
        "unified_extractor.cli",
        "extract",
        str(input_path),
        "--output",
        str(output_path),
    ]

    if input_path.is_dir():
        cmd.append("--batch")

    if args.analyze_images:
        cmd.append("--analyze-images")
        cmd.extend(["--ai-backend", args.ai_backend])

    if args.screenshots:
        cmd.append("--screenshots")
        cmd.extend(["--screenshot-dpi", str(args.screenshot_dpi)])

    env = os.environ.copy()
    env["PYTHONPATH"] = f"{tools_root}{os.pathsep}{env.get('PYTHONPATH', '')}"

    logger.info("Running unified extractor: %s", " ".join(cmd))
    result = subprocess.run(cmd, env=env, check=False)
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Convert PPTX to Learning Content")
    parser.add_argument("--input", "-i", required=True, help="Input directory OR single .pptx file")
    parser.add_argument("--output", "-o", required=True, help="Output directory")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    parser.add_argument(
        "--engine",
        choices=["auto", "legacy", "unified"],
        default="auto",
        help="Extraction engine to use (auto prefers unified_extractor if available)"
    )
    parser.add_argument("--analyze-images", action="store_true", help="Enable AI image analysis (unified only)")
    parser.add_argument(
        "--ai-backend",
        default="auto",
        choices=["auto", "lmstudio", "ollama", "gemini", "anthropic", "none"],
        help="AI backend for image analysis (unified only)"
    )
    parser.add_argument("--screenshots", action="store_true", help="Generate slide screenshots (unified only)")
    parser.add_argument("--screenshot-dpi", type=int, default=150, help="DPI for screenshots (unified only)")
    
    args = parser.parse_args()
    setup_logging(args.verbose)
    
    logger = logging.getLogger(__name__)
    
    if not os.path.exists(args.input):
        logger.error(f"Input path does not exist: {args.input}")
        sys.exit(1)

    # Prefer unified extractor if requested or auto-selected
    if args.engine in ("auto", "unified"):
        unified_ok = _run_unified_extractor(args, logger)
        if unified_ok:
            logger.info("Unified extraction complete. Output in %s", args.output)
            return
        if args.engine == "unified":
            logger.error("Unified extraction failed.")
            sys.exit(1)

    # Prepare directories (legacy mode)
    media_dir = os.path.join(args.output, "media")
    os.makedirs(media_dir, exist_ok=True)

    # Discovery logic
    pptx_files = []
    if os.path.isfile(args.input):
        if args.input.endswith(".pptx") or args.input.endswith(".ppt"):
            pptx_files.append(args.input)
        else:
            logger.error("Input file is not a .pptx file")
            sys.exit(1)
    else:
        # Directory mode
        pptx_files = glob.glob(os.path.join(args.input, "*.pptx"))
        if not pptx_files:
            logger.warning(f"No .pptx files found in {args.input}")
            sys.exit(1)
        
    extractor = PptxExtractor()
    generator = SiteGenerator()
    
    presentations = []
    
    for file_path in pptx_files:
        try:
            p_data = extractor.extract(file_path, media_dir)
            presentations.append(p_data)
        except Exception as e:
            logger.error(f"Failed to process {file_path}", exc_info=True)

    if presentations:
        generator.generate(presentations, args.output)
        logger.info(f"Successfully generated content for {len(presentations)} presentations in {args.output}")
    else:
        logger.error("No presentations were successfully processed")
        sys.exit(1)

if __name__ == "__main__":
    main()
