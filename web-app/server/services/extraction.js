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

        // Normalize unified output layout (flatten nested folder if needed)
        if (code === 0) {
            const fs = require('fs');
            try {
                const nestedDir = path.join(outputDir, id);
                const nestedJson = path.join(nestedDir, 'presentation.json');
                const targetJson = path.join(outputDir, 'presentation.json');
                if (fs.existsSync(nestedJson) && !fs.existsSync(targetJson)) {
                    fs.renameSync(nestedJson, targetJson);
                }
                const nestedMedia = path.join(nestedDir, 'media');
                const targetMedia = path.join(outputDir, 'media');
                if (fs.existsSync(nestedMedia) && !fs.existsSync(targetMedia)) {
                    fs.renameSync(nestedMedia, targetMedia);
                }
                const nestedScreens = path.join(nestedDir, 'screenshots');
                const targetScreens = path.join(outputDir, 'screenshots');
                if (fs.existsSync(nestedScreens) && !fs.existsSync(targetScreens)) {
                    fs.renameSync(nestedScreens, targetScreens);
                }
                if (fs.existsSync(nestedDir)) {
                    const remaining = fs.readdirSync(nestedDir);
                    if (remaining.length === 0) {
                        fs.rmdirSync(nestedDir);
                    }
                }
            } catch (e) {
                console.warn(`Layout normalization failed for ${id}:`, e.message);
            }
        }

        // Extract metadata from output JSON (legacy and unified)
        if (code === 0) {
            const fs = require('fs');
            try {
                let data = null;

                // Legacy output: <outputDir>/json/*.json
                const jsonDir = path.join(outputDir, 'json');
                if (fs.existsSync(jsonDir)) {
                    try {
                        const jsonFiles = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
                        if (jsonFiles.length > 0) {
                            const jsonPath = path.join(jsonDir, jsonFiles[0]);
                            data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                        }
                    } catch (err) {
                        console.warn(`Metadata scan failed for ${jsonDir}:`, err.message);
                    }
                }

                // Unified output: <outputDir>/<presentation-id>/presentation.json
                if (!data) {
                    const nestedDir = path.join(outputDir, id);
                    const nestedJson = path.join(nestedDir, 'presentation.json');
                    if (fs.existsSync(nestedJson)) {
                        data = JSON.parse(fs.readFileSync(nestedJson, 'utf8'));
                    }
                }

                // Unified output (generic): <outputDir>/<any>/presentation.json
                if (!data && fs.existsSync(outputDir)) {
                    try {
                        const candidates = fs.readdirSync(outputDir, { withFileTypes: true })
                            .filter(entry => entry.isDirectory())
                            .map(entry => path.join(outputDir, entry.name, 'presentation.json'))
                            .filter(p => fs.existsSync(p));
                        if (candidates.length > 0) {
                            data = JSON.parse(fs.readFileSync(candidates[0], 'utf8'));
                        }
                    } catch (err) {
                        console.warn(`Metadata scan failed for ${outputDir}:`, err.message);
                    }
                }

                if (data?.metadata) {
                    db.updateMetadata(id, data.metadata);
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
function runScreenshotGeneration(id, inputPath, outputDir, slides = null) {
    const pythonProcess = spawn(PYTHON_PATH, [
        '-c',
        `
from pathlib import Path
from src.ppt_to_learning.extractors.png_generator import generate_slide_pngs, generate_slide_pngs_for_slides, check_libreoffice

if not check_libreoffice():
    print("ERROR: LibreOffice not installed")
    exit(1)

slides = ${slides ? JSON.stringify(slides) : 'None'}
if slides:
    pngs = generate_slide_pngs_for_slides(
        Path("${inputPath.replace(/\\/g, '\\\\')}"),
        Path("${outputDir.replace(/\\/g, '\\\\')}"),
        slides=slides,
        dpi=150
    )
else:
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
