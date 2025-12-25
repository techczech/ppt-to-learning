#!/usr/bin/env python3
import sys
import os

# Ensure src is in python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from ppt_to_learning.cli import main

if __name__ == "__main__":
    # If no args provided, use defaults to match legacy behavior
    if len(sys.argv) == 1:
        # Legacy defaults
        sys.argv.append("--input")
        sys.argv.append("sourcefiles/czech")
        sys.argv.append("--output")
        sys.argv.append("output/czech")
        
    main()
