const { z } = require('zod');

const baseGuestWifiSchema = z.object({
  guest_name: z.string().min(2).max(100),
  wifi_username: z.string().min(3).max(50),
  wifi_password: z.string().min(6).max(100),
  start_date: z.string().datetime({ message: "Invalid start date format. Expected ISO Datetime" }),
  expiration_date: z.string().datetime({ message: "Invalid expiration date format. Expected ISO Datetime" }),
  purpose: z.string().max(500).optional().nullable(),
  requested_by_employee_id: z.number().int().positive().optional().nullable(),
  status: z.enum(['Active', 'Expired', 'Revoked']).default('Active')
});

const createGuestWifiSchema = baseGuestWifiSchema.refine(data => new Date(data.expiration_date) > new Date(data.start_date), {
  message: "Expiration date must be after the start date.",
  path: ["expiration_date"]
});

const updateGuestWifiSchema = baseGuestWifiSchema.partial().refine(data => {
  if (data.start_date && data.expiration_date) {
    return new Date(data.expiration_date) > new Date(data.start_date);
  }
  return true;
}, {
  message: "Expiration date must be after the start date.",
  path: ["expiration_date"]
});

module.exports = {
  createGuestWifiSchema,
  updateGuestWifiSchema
};
