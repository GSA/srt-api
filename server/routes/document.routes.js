const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const logger = require('../config/winston');

const PYTHON_PATH = 'python3';
const SCRIPT_ARGS = ['-m', 'srt_ml.predict.analyze_text'];

logger.info(`PYTHON_PATH: ${PYTHON_PATH}`);
logger.info(`SCRIPT_ARGS: ${SCRIPT_ARGS.join(' ')}`);

router.post('/analyze-documents', express.json(), async (req, res) => {
  try {
    const documents = req.body.documents;
    if (!documents || Object.keys(documents).length === 0) {
      logger.warn('No document texts were provided.');
      return res.status(400).json({ error: 'No document texts provided' });
    }

    logger.info(`Processing ${Object.keys(documents).length} document(s)...`);

    // Create a JSON payload to send via STDIN
    const inputData = JSON.stringify({ documents });
    logger.info(`Sending payload to Python: ${inputData}`);

    // Spawn the Python process with piped stdio so we can write to STDIN and read STDOUT
    const pythonProcess = spawn(PYTHON_PATH, SCRIPT_ARGS, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr data and log it
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      logger.error(`Python stderr: ${data.toString().trim()}`);
    });

    pythonProcess.on('error', (error) => {
      logger.error(`Failed to start Python process: ${error.message}`);
    });

    // Write the JSON payload to the Python process's STDIN and close it
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();

    // When the Python process closes, process the output
    pythonProcess.on('close', (code) => {
      logger.info(`Python process exited with code: ${code}`);
      logger.info(`Raw Python output: ${stdout}`);

      if (code !== 0) {
        const errorMsg = stderr || `Python process exited with code ${code}`;
        logger.error(`Python process failed: ${errorMsg}`);
        return res.status(500).json({ error: errorMsg });
      }

      let result;
      try {
        result = JSON.parse(stdout);
      } catch (parseError) {
        logger.error(`Failed to parse Python output: ${parseError.message}`);
        logger.error(`Raw output: ${stdout}`);
        return res.status(500).json({ error: 'Invalid response from Python process' });
      }

      logger.info(`Parsed Python result: ${JSON.stringify(result)}`);

      // Convert boolean predictions into "compliant" / "non-compliant" strings.
      const transformed = {};
      for (const fname in result.predictions) {
        const prediction = result.predictions[fname];
        logger.info(`Document: ${fname}, Prediction: ${prediction}`);
        // Handle both boolean and string cases
        const isCompliant = prediction === true || prediction === 'True' || prediction === 'compliant';
        transformed[fname] = isCompliant ? 'compliant' : 'non-compliant';
      }

      logger.info(`Transformed result: ${JSON.stringify(transformed)}`);
      res.json(transformed);
    });
  } catch (error) {
    logger.error(`Unexpected error during document analysis: ${error.message}`);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

module.exports = router;
