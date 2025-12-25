import argparse
import os
import glob
import logging
from .extractors.pptx_extractor import PptxExtractor
from .generators.site_generator import SiteGenerator

def setup_logging(verbose=False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format='%(asctime)s - %(levelname)s - %(message)s')

def main():
    parser = argparse.ArgumentParser(description="Convert PPTX to Learning Content")
    parser.add_argument("--input", "-i", required=True, help="Input directory OR single .pptx file")
    parser.add_argument("--output", "-o", required=True, help="Output directory")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    setup_logging(args.verbose)
    
    logger = logging.getLogger(__name__)
    
    if not os.path.exists(args.input):
        logger.error(f"Input path does not exist: {args.input}")
        return

    # Prepare directories
    media_dir = os.path.join(args.output, "media")
    os.makedirs(media_dir, exist_ok=True)
    
    # Discovery logic
    pptx_files = []
    if os.path.isfile(args.input):
        if args.input.endswith(".pptx") or args.input.endswith(".ppt"):
            pptx_files.append(args.input)
        else:
            logger.error("Input file is not a .pptx file")
            return
    else:
        # Directory mode
        pptx_files = glob.glob(os.path.join(args.input, "*.pptx"))
        if not pptx_files:
            logger.warning(f"No .pptx files found in {args.input}")
            return
        
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

if __name__ == "__main__":
    main()