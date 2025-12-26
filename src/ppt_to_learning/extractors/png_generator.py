"""
PNG Screenshot Generator for PowerPoint slides.

Uses LibreOffice (headless) to convert PPTX to PDF, then Poppler (via pdf2image) to extract PNGs.
"""

import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Optional

from pdf2image import convert_from_path


def check_libreoffice() -> bool:
    """Check if LibreOffice is available."""
    return shutil.which("soffice") is not None


def generate_slide_pngs(
    pptx_path: Path,
    output_dir: Path,
    dpi: int = 150,
    on_progress: Optional[callable] = None
) -> list[Path]:
    """
    Convert PPTX to PNG images for each slide.

    Args:
        pptx_path: Path to the PPTX file
        output_dir: Directory to save PNG files (will create 'screenshots' subdirectory)
        dpi: Resolution for PNG output (default: 150)
        on_progress: Optional callback(current, total, message) for progress updates

    Returns:
        List of paths to generated PNG files

    Raises:
        RuntimeError: If LibreOffice is not installed
        subprocess.CalledProcessError: If conversion fails
    """
    if not check_libreoffice():
        raise RuntimeError(
            "LibreOffice is not installed. Install with: brew install --cask libreoffice"
        )

    # Create screenshots directory
    screenshots_dir = output_dir / "screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    if on_progress:
        on_progress(0, 100, "Converting PPTX to PDF...")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        # Step 1: PPTX → PDF via LibreOffice
        # LibreOffice names the output based on input filename
        result = subprocess.run(
            [
                "soffice",
                "--headless",
                "--invisible",
                "--convert-to", "pdf",
                "--outdir", str(tmp_path),
                str(pptx_path)
            ],
            capture_output=True,
            text=True,
            check=True
        )

        # Find the generated PDF (LibreOffice uses input filename with .pdf extension)
        pdf_name = pptx_path.stem + ".pdf"
        pdf_path = tmp_path / pdf_name

        if not pdf_path.exists():
            # Try to find any PDF in the temp directory
            pdfs = list(tmp_path.glob("*.pdf"))
            if pdfs:
                pdf_path = pdfs[0]
            else:
                raise RuntimeError(
                    f"LibreOffice did not generate PDF. Output: {result.stdout} {result.stderr}"
                )

        if on_progress:
            on_progress(30, 100, "Converting PDF pages to PNG...")

        # Step 2: PDF → PNGs via poppler
        images = convert_from_path(pdf_path, dpi=dpi)

        total_slides = len(images)
        png_paths = []

        for i, img in enumerate(images, 1):
            png_path = screenshots_dir / f"slide_{i:04d}.png"
            img.save(png_path, "PNG", optimize=True)
            png_paths.append(png_path)

            if on_progress:
                progress = 30 + int((i / total_slides) * 70)
                on_progress(progress, 100, f"Saved slide {i}/{total_slides}")

        if on_progress:
            on_progress(100, 100, f"Generated {total_slides} screenshots")

        return png_paths


def get_screenshot_path(output_dir: Path, slide_number: int) -> Path:
    """Get the expected path for a slide screenshot."""
    return output_dir / "screenshots" / f"slide_{slide_number:04d}.png"


def has_screenshots(output_dir: Path) -> bool:
    """Check if screenshots directory exists and has files."""
    screenshots_dir = output_dir / "screenshots"
    if not screenshots_dir.exists():
        return False
    return any(screenshots_dir.glob("slide_*.png"))


def count_screenshots(output_dir: Path) -> int:
    """Count the number of screenshots in the output directory."""
    screenshots_dir = output_dir / "screenshots"
    if not screenshots_dir.exists():
        return 0
    return len(list(screenshots_dir.glob("slide_*.png")))
