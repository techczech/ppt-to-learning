from abc import ABC, abstractmethod
from typing import List, Any
from .models import Presentation

class IPresentationExtractor(ABC):
    """
    Interface for extracting content from a presentation file.
    """
    @abstractmethod
    def extract(self, file_path: str, media_output_dir: str) -> Presentation:
        """
        Extract data from a presentation file.

        Args:
            file_path: Path to the input presentation file.
            media_output_dir: Directory where extracted media (images) should be saved.

        Returns:
            Presentation object containing the structured content.
        """
        pass

class ISiteGenerator(ABC):
    """
    Interface for generating the output site (JSON, HTML, etc.).
    """
    @abstractmethod
    def generate(self, presentations: List[Presentation], output_dir: str):
        """
        Generate the site content.

        Args:
            presentations: List of Presentation objects.
            output_dir: Directory where the output should be generated.
        """
        pass