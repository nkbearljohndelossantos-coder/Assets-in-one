const { z } = require('zod');

// Regex to validate MAC Addresses (e.g., E4:A8:DF:12:34:56 or E4-A8-DF-12-34-56)
const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

const createNetworkDeviceSchema = z.object({
  device_name: z.string().min(2).max(100),
  device_type: z.string().min(2).max(50),
  brand: z.string().min(2).max(50),
  model: z.string().min(2).max(50),
  status: z.enum(['Online', 'Offline', 'Maintenance']).default('Online'),
  remarks: z.string().max(500).optional().nullable(),
  
  // Mapped IP Allocation info (optional, creates the central allocation during save)
  ip_address: z.string().regex(/^[\w.:]+$/, { message: "Invalid IPv4/IPv6 address" }).optional().nullable(),
  mac_address: z.string().regex(macRegex, { message: "Invalid MAC address format (XX:XX:XX:XX:XX:XX)" }).optional().nullable(),
  vlan: z.string().optional().nullable(),
  subnet: z.string().optional().nullable(),
  gateway: z.string().regex(/^[\w.:]+$/, { message: "Invalid Gateway IP" }).optional().nullable()
});

const updateNetworkDeviceSchema = createNetworkDeviceSchema.partial();

const createWifiNetworkSchema = z.object({
  access_point_name: z.string().min(2).max(100),
  building: z.string().max(100).optional().nullable(),
  floor: z.string().max(50).optional().nullable(),
  ssid: z.string().min(1).max(100),
  coverage_area: z.string().optional().nullable(),
  channel: z.string().optional().nullable(),
  status: z.enum(['Active', 'Inactive']).default('Active'),

  // Mapped IP Allocation info
  ip_address: z.string().regex(/^[\w.:]+$/, { message: "Invalid IPv4/IPv6 address" }).optional().nullable(),
  vlan: z.string().optional().nullable(),
  subnet: z.string().optional().nullable(),
  gateway: z.string().regex(/^[\w.:]+$/, { message: "Invalid Gateway IP" }).optional().nullable()
});

const updateWifiNetworkSchema = createWifiNetworkSchema.partial();

const createUserNetworkAssignmentSchema = z.object({
  employee_id: z.number().int().positive(),
  asset_id: z.number().int().positive().optional().nullable(),
  ip_address: z.string().regex(/^[\w.:]+$/, { message: "Invalid IPv4/IPv6 address" }),
  mac_address: z.string().regex(macRegex, { message: "Invalid MAC address format" }),
  switch_port: z.string().max(50).optional().nullable(),
  switch_id: z.number().int().positive().optional().nullable(), // Switch device FK
  access_point_id: z.number().int().positive().optional().nullable(),
  department_id: z.number().int().positive().optional().nullable(),
  vlan: z.string().optional().nullable(),
  subnet: z.string().optional().nullable(),
  gateway: z.string().regex(/^[\w.:]+$/, { message: "Invalid Gateway IP" }).optional().nullable()
});

const updateUserNetworkAssignmentSchema = createUserNetworkAssignmentSchema.partial();

module.exports = {
  createNetworkDeviceSchema,
  updateNetworkDeviceSchema,
  createWifiNetworkSchema,
  updateWifiNetworkSchema,
  createUserNetworkAssignmentSchema,
  updateUserNetworkAssignmentSchema
};
