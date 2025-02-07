const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../config/winston');

// Update paths for srt-ml and use system Python
const ML_PATH = '/opt/ml';
const SCRIPT_PATH = path.join(ML_PATH, 'src', 'srt_ml', 'predict', 'analyze_text.py');
const PYTHON_PATH = 'python3';

// Log the paths to verify
logger.info(`ML_PATH: ${ML_PATH}`);
logger.info(`SCRIPT_PATH: ${SCRIPT_PATH}`);
logger.info(`PYTHON_PATH: ${PYTHON_PATH}`);

// Rest of the router code remains the same since it already handles stdin/stdout correctly
router.post('/analyze-documents', express.json(), async (req, res) => {
  const results = {};

  try {
    const documents = req.body.documents;
    
    if (!documents || Object.keys(documents).length === 0) {
      logger.warn('No document texts were provided.');
      return res.status(400).json({ error: 'No document texts provided' });
    }

    logger.info(`Processing ${Object.keys(documents).length} document(s)...`);

    for (const [filename, text] of Object.entries(documents)) {
      logger.info(`Starting analysis for document: ${filename}`);

      try {
        const prediction = await new Promise((resolve, reject) => {
          const scraperProcess = spawn(PYTHON_PATH, [
            SCRIPT_PATH
          ]);
          
          let stdout = '';
          let stderr = '';
          
          scraperProcess.stdin.write(text);
          scraperProcess.stdin.end();
          
          scraperProcess.stdout.on('data', (data) => {
            stdout += data;
            logger.info(`ML stdout for ${filename}: ${data.toString().trim()}`);
          });

          scraperProcess.stderr.on('data', (data) => {
            stderr += data;
            logger.error(`ML stderr for ${filename}: ${data.toString().trim()}`);
          });

          scraperProcess.on('error', (error) => {
            logger.error(`Failed to start ML process for ${filename}: ${error.message}`);
            reject(new Error(`Failed to start ML process: ${error.message}`));
          });

          scraperProcess.on('close', (code) => {
            if (code === 0 && stdout) {
              logger.info(`ML completed successfully for document: ${filename}`);
              resolve(stdout.trim());
            } else {
              const errorMsg = stderr || `Process exited with code ${code}`;
              logger.error(`ML failed for ${filename}: ${errorMsg}`);
              reject(new Error(errorMsg));
            }
          });
        });

        let result;
        try {
          result = JSON.parse(prediction);
        } catch (parseError) {
          logger.error(`Failed to parse ML output for ${filename}: ${parseError.message}`);
          logger.error(`Raw output: ${prediction}`);
          throw new Error('Invalid response from ML process');
        }
        
        if (result.error) {
          throw new Error(result.error);
        }

        results[filename] = {
          status: result.prediction === 1 ? 'compliant' : 'non-compliant',
          text: text,
          details: {
            prediction: result.prediction,
            decisionBoundary: result.decision_boundary
          }
        };
        
        logger.info(`Prediction for document ${filename}: ${results[filename].status}`);
      } catch (error) {
        logger.error(`Error processing document ${filename}: ${error.message}`);
        results[filename] = { error: error.message };
      }
    }

    res.json(results);
  } catch (error) {
    logger.error(`Unexpected error during document analysis: ${error.message}`);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

module.exports = router;