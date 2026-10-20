const secretsService = require('../services/secretsService');
const { revealSecretSchema } = require('../validators/secretsValidator');
const logger = require('../utils/logger');

exports.revealSecret = async (req, res) => {
  try {
    const validatedData = revealSecretSchema.parse(req.body);
    const secret = await secretsService.revealSecret(validatedData, req);
    res.json({ secret });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error(`Error in revealSecret: ${error.message}`);
    
    // We do not leak details if it's a general decryption failure, but we pass known errors safely
    if (error.message.includes('not found') || error.message.includes('Failed to decrypt')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to process secret reveal request' });
  }
};
