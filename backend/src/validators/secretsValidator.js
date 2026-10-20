const { z } = require('zod');

const revealSecretSchema = z.object({
  module: z.enum(['Licenses', 'GuestWifi', 'Antivirus', 'OperatingSystems']),
  recordId: z.number().int().positive()
});

module.exports = {
  revealSecretSchema
};
