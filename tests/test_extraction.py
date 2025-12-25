import unittest
from unittest.mock import MagicMock, PropertyMock
import os
import sys

# Add src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from ppt_to_learning.extractors.pptx_extractor import PptxExtractor
from ppt_to_learning.core.models import SlideElement

class TestPptxExtractor(unittest.TestCase):
    
    def test_basic_extraction(self):
        # Mock Presentation and its components
        mock_prs = MagicMock()
        mock_slide = MagicMock()
        mock_shape_title = MagicMock()
        mock_shape_text = MagicMock()
        
        # Setup Slides
        mock_prs.slides = [mock_slide]
        
        # Setup Shapes
        # 1. Title
        mock_shape_title.has_text_frame = True
        mock_shape_title.text_frame.text = "Test Title"
        mock_shape_title.top = 0
        mock_shape_title.left = 0
        
        # 2. Text
        mock_shape_text.has_text_frame = True
        mock_shape_text.text_frame.text = "Bullet 1"
        mock_shape_text.text_frame.paragraphs = [MagicMock(text="Bullet 1")]
        mock_shape_text.top = 100
        mock_shape_text.left = 0
        
        # slide.shapes needs to be iterable AND have attributes
        mock_shapes = MagicMock()
        mock_shapes.__iter__.return_value = [mock_shape_title, mock_shape_text]
        mock_shapes.title = mock_shape_title
        
        mock_slide.shapes = mock_shapes
        
        # Mock sections (empty)
        # We need to mock the internal XML structure or the helper method
        # Easier: mock the _extract_sections method of the instance if we were testing logic,
        # but here let's just let it return [] (exception raised on mock XML access caught silently)
        
        # Patch Presentation class used in PptxExtractor
        with unittest.mock.patch('ppt_to_learning.extractors.pptx_extractor.Presentation', return_value=mock_prs):
            extractor = PptxExtractor()
            # We use a dummy path, os.makedirs is mocked? No, let's use a temporary dir or mock it
            
            with unittest.mock.patch('os.makedirs'):
                data = extractor.extract("dummy.pptx", "dummy_media_dir")
                
                self.assertEqual(len(data.slides), 1)
                self.assertEqual(data.slides[0].title, "Test Title")
                self.assertEqual(len(data.slides[0].elements), 2)
                self.assertEqual(data.slides[0].elements[0].type, "title")
                self.assertEqual(data.slides[0].elements[1].type, "text")

if __name__ == '__main__':
    unittest.main()
