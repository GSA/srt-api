const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const logger = require('../config/winston');

// Use the installed package's analyze_text script
// When installed via pip, it will be in the Python package directory
const PYTHON_PATH = 'python3';
const SCRIPT_NAME = '-m srt_ml.predict.analyze_text';

logger.info(`PYTHON_PATH: ${PYTHON_PATH}`);
logger.info(`SCRIPT_NAME: ${SCRIPT_NAME}`);

router.post('/analyze-documents', express.json(), async (req, res) => {
  const results = {};

  try {
    const documents = req.body.documents;

    if (!documents || Object.keys(documents).length === 0) {
      logger.warn('No document texts were provided.');
      return res.status(400).json({ error: 'No document texts provided' });
    }

    logger.info(`Processing ${Object.keys(documents).length} document(s)...`);

    // Process each document
    for (const [filename, text] of Object.entries(documents)) {
      logger.info(`Starting analysis for document: ${filename}`);

      try {
        const predictionOutput = await new Promise((resolve, reject) => {
          // Spawn the Python process with the required command-line arguments
          const mlProcess = spawn(PYTHON_PATH, [
            '-m',
            'srt_ml.predict.analyze_text',
            '--filename',
            filename,
            '--text',
            text
          ]);

          let stdout = '';
          let stderr = '';

          mlProcess.stdout.on('data', (data) => {
            stdout += data;
            logger.info(`ML stdout for ${filename}: ${data.toString().trim()}`);
          });

          mlProcess.stderr.on('data', (data) => {
            stderr += data;
            logger.error(`ML stderr for ${filename}: ${data.toString().trim()}`);
          });

          mlProcess.on('error', (error) => {
            logger.error(`Failed to start ML process for ${filename}: ${error.message}`);
            reject(new Error(`Failed to start ML process: ${error.message}`));
          });

          mlProcess.on('close', (code) => {
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
          result = JSON.parse(predictionOutput);
        } catch (parseError) {
          logger.error(`Failed to parse ML output for ${filename}: ${parseError.message}`);
          logger.error(`Raw output: ${predictionOutput}`);
          throw new Error('Invalid response from ML process');
        }

        if (result.error) {
          throw new Error(result.error);
        }

        // Retrieve the prediction from the correct key
        const mlPrediction = result.predictions && result.predictions[filename];

        // Interpret the prediction: true means compliant, false means non-compliant
        results[filename] = {
          status: mlPrediction === true ? 'compliant' : 'non-compliant',
          text: text,
          details: {
            prediction: mlPrediction,
            decisionBoundary: result.decision_boundary // if provided by the ML output
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
