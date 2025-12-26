const { spawn } = require('child_process');
const path = require('path');
const db = require('../db');

const ROOT_DIR = path.resolve(__dirname, '../../../');
const PYTHON_PATH = path.join(ROOT_DIR, '.venv/bin/python3');

/**
 * Run PPTX extraction via Python subprocess
 */
function runConversion(id, inputPath, outputDir, options = {}) {
    db.updateStatus(id, 'processing');

    const pythonProcess = spawn(PYTHON_PATH, [
        '-m', 'src.ppt_to_learning.cli',
        '--input', inputPath,
        '--output', outputDir,
        '--verbose'
    ], { cwd: ROOT_DIR });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Extraction failed for ${id}:`, stderr);
        }

        db.updateStatus(id, code === 0 ? 'completed' : 'failed');

        // Extract metadata from output JSON
        if (code === 0) {
            const fs = require('fs');
            try {
                const jsonDir = path.join(outputDir, 'json');
                const jsonFiles = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
                if (jsonFiles.length > 0) {
                    const jsonPath = path.join(jsonDir, jsonFiles[0]);
                    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    if (data.metadata) {
                        db.updateMetadata(id, data.metadata);
                    }
                }
            } catch (e) {
                console.error(`Failed to extract metadata for ${id}:`, e.message);
            }
        }

        // Optionally generate screenshots after conversion completes
        if (code === 0 && options.generateScreenshots) {
            runScreenshotGeneration(id, inputPath, outputDir);
        }
    });
}

/**
 * Generate PNG screenshots from PPTX via LibreOffice
 */
function runScreenshotGeneration(id, inputPath, outputDir) {
    const pythonProcess = spawn(PYTHON_PATH, [
        '-c',
        `
from pathlib import Path
from src.ppt_to_learning.extractors.png_generator import generate_slide_pngs, check_libreoffice

if not check_libreoffice():
    print("ERROR: LibreOffice not installed")
    exit(1)

pngs = generate_slide_pngs(
    Path("${inputPath.replace(/\\/g, '\\\\')}"),
    Path("${outputDir.replace(/\\/g, '\\\\')}"),
    dpi=150
)
print(f"Generated {len(pngs)} screenshots")
        `
    ], { cwd: ROOT_DIR });

    let output = '';
    pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { output += data.toString(); });

    pythonProcess.on('close', (code) => {
        if (code === 0) {
            console.log(`Screenshots generated for ${id}: ${output.trim()}`);
        } else {
            console.error(`Screenshot generation failed for ${id}: ${output}`);
        }
    });
}

module.exports = {
    runConversion,
    runScreenshotGeneration,
    ROOT_DIR,
    PYTHON_PATH
};
