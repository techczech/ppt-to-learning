from pptx import Presentation
import os

def check_sections(path):
    print(f"Checking: {path}")
    try:
        prs = Presentation(path)
        # Check if sections attribute exists
        if not hasattr(prs, 'sections'):
            print(" - 'sections' attribute NOT found on Presentation object.")
            return

        print(f" - Found {len(prs.sections)} sections.")
        for section in prs.sections:
            print(f"   - Section: {section.title}")
            print(f"     - Slides: {len(section.slides)}")
            
    except Exception as e:
        print(f"Error: {e}")

# Test with a file likely to have sections, or just any file
file_path = "sourcefiles/czech/Czech Images.pptx"
if os.path.exists(file_path):
    check_sections(file_path)
else:
    print(f"File not found: {file_path}")
