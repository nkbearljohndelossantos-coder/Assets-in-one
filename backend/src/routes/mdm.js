const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const { randomUUID } = require("crypto");
const db = require("../config/db");
const logger = require("../utils/logger");
const { buildDevicePolicyPayload } = require("../utils/mdmPolicy");

const JWT_SECRET = process.env.MDM_JWT_SECRET || process.env.JWT_SECRET || "nkb_itms_enterprise_mdm_jwt_secret_2026";

// Dedicated Android Agent APK download endpoint
router.get("/download-apk", (req, res) => {
  const path = require("path");
  const fs = require("fs");
  const apkPath = path.join(__dirname, "../../uploads/NKB-ITMS-Agent.apk");
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", 'attachment; filename="NKB-ITMS-Agent.apk"');

  if (fs.existsSync(apkPath)) {
    return res.sendFile(apkPath);
  }
  const distPath = path.join(__dirname, "../../../client/dist/uploads/NKB-ITMS-Agent.apk");
  if (fs.existsSync(distPath)) {
    return res.sendFile(distPath);
  }
  return res.status(404).json({ success: false, message: "APK file not found" });
});

// ======================================================
// HEALTH CHECK
// ======================================================
router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "NKB Manufacturing Enterprise MDM",
    status: "online",
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// POLICIES API
// ======================================================
router.get("/policies", async (req, res) => {
  try {
    const policies = await db("webfilter_policies").select("*");
    res.json({ success: true, data: policies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/policies/:id", async (req, res) => {
  try {
    const policy = await db("webfilter_policies").where("id", req.params.id).first();
    if (!policy) {
      return res.status(404).json({ success: false, message: "Policy not found" });
    }
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// DEVICES API (PERSISTED IN DB)
// ======================================================
router.get("/devices", async (req, res) => {
  try {
    const devices = await db("mdm_enrolled_devices")
      .leftJoin("employees", "mdm_enrolled_devices.employee_id", "employees.id")
      .select("mdm_enrolled_devices.*", "employees.first_name", "employees.last_name", "employees.employee_number")
      .orderBy("mdm_enrolled_devices.id", "desc");

    res.json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// DEVICE POLICY PULL FOR ANDROID DPC AGENT
// ======================================================
router.get("/devices/:deviceId/policy", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await db("mdm_enrolled_devices").where("device_id", deviceId).first();

    const policyPayload = await buildDevicePolicyPayload(device ? device.policy_id : null);

    res.json({
      success: true,
      data: {
        device: device || {
          deviceId,
          deviceName: "NKB Android Workstation",
          status: "enrolled",
          workModeEnabled: true
        },
        policy: policyPayload
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// CREATE ENROLLMENT TOKEN & DUAL DPC QR CODES
// ======================================================
router.post("/enrollment/create", async (req, res) => {
  try {
    const { employeeId, employeeName, department, policyId } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "employeeId is required"
      });
    }

    const activePolicy = policyId
      ? await db("webfilter_policies").where("id", policyId).first()
      : await db("webfilter_policies").where("is_active", true).first();

    const enrollmentId = `ENROLL-${randomUUID().substring(0, 8).toUpperCase()}`;
    const token = jwt.sign(
      {
        enrollmentId,
        employeeId,
        employeeName: employeeName || "NKB Employee",
        department: department || "Production",
        policyId: activePolicy ? activePolicy.id : 1
      },
      JWT_SECRET,
      { expiresIn: "30m" }
    );

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Save persistent token to DB
    await db("mdm_enrollment_tokens").insert({
      enrollment_id: enrollmentId,
      token_hash: token,
      employee_id: typeof employeeId === "number" ? employeeId : null,
      employeeName: employeeName || "NKB Employee",
      department: department || "Production",
      policy_id: activePolicy ? activePolicy.id : 1,
      status: "pending",
      expires_at: expiresAt,
      created_at: new Date()
    }).catch(() => {});

    const host = req.get("host");
    const protocol = req.protocol || "http";
    const serverBaseUrl = process.env.MDM_SERVER_URL || `${protocol}://${host}`;

    // 1. Universal Camera Scan URL
    const scanUrl = `${serverBaseUrl}/api/v1/webfilter/qr-scan?token=${enrollmentId}&action=ENABLE_WORK_MODE&sig=NKB_SECURE`;

    // 2. Android Enterprise Device Owner Provisioning JSON (Format for Android Setup Wizard)
    const androidProvisioningPayload = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.nkb.itms.agent/.AdminReceiver",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": `${serverBaseUrl}/uploads/NKB-ITMS-Agent.apk`,
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
        "serverUrl": serverBaseUrl,
        "enrollmentToken": token,
        "policyId": activePolicy ? activePolicy.id : 1
      }
    };

    // Generate Universal Web Scan QR Code
    const qrCode = await QRCode.toDataURL(scanUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 400
    });

    // Generate Android Enterprise Provisioning QR Code
    const androidQrCode = await QRCode.toDataURL(JSON.stringify(androidProvisioningPayload), {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 400
    });

    res.json({
      success: true,
      message: "MDM Enrollment QR codes created successfully",
      data: {
        enrollmentId,
        employeeId,
        employeeName: employeeName || "NKB Employee",
        department: department || "Production",
        policyId: activePolicy ? activePolicy.id : 1,
        policyName: activePolicy ? activePolicy.name : "STRICT WORK MODE",
        scanUrl,
        qrCode,
        androidQrCode,
        androidProvisioningPayload,
        expiresAt
      }
    });

  } catch (error) {
    if (logger && logger.error) logger.error(`MDM Enrollment Create error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to create MDM enrollment QR: ${error.message}`
    });
  }
});

// ======================================================
// ENROLL DEVICE (PERSIST TO DB)
// ======================================================
router.post("/enrollment/complete", async (req, res) => {
  try {
    const { enrollmentToken, deviceId, deviceName, manufacturer, model, androidVersion, serialNumber } = req.body;

    if (!enrollmentToken || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "enrollmentToken and deviceId are required"
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(enrollmentToken, JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired enrollment token"
      });
    }

    const existing = await db("mdm_enrolled_devices").where("device_id", deviceId).first();
    if (existing) {
      return res.json({
        success: true,
        message: "Device already enrolled",
        data: existing
      });
    }

    const [id] = await db("mdm_enrolled_devices").insert({
      device_id: deviceId,
      device_name: deviceName || `${manufacturer || "Android"} ${model || "Device"}`,
      manufacturer: manufacturer || "Generic",
      model: model || "Device",
      android_version: androidVersion || "14",
      serial_number: serialNumber || deviceId,
      employee_id: typeof decoded.employeeId === "number" ? decoded.employeeId : null,
      employee_name: decoded.employeeName || "Employee",
      policy_id: decoded.policyId || 1,
      api_key_hash: jwt.sign({ deviceId }, JWT_SECRET),
      enrollment_id: decoded.enrollmentId,
      work_mode_enabled: true,
      is_online: true,
      is_compliant: true,
      status: "enrolled",
      last_seen: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });

    const newDevice = await db("mdm_enrolled_devices").where("id", id).first();

    res.json({
      success: true,
      message: "Device successfully enrolled into NKB Enterprise MDM",
      data: newDevice
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Device enrollment failed: ${error.message}`
    });
  }
});

// ======================================================
// DEVICE TELEMETRY HEARTBEAT (PERSIST TO DB)
// ======================================================
router.post("/devices/telemetry", async (req, res) => {
  try {
    const { deviceId, batteryLevel, isCharging, networkType, wifiSsid, isWorkModeActive, isCompliant } = req.body;

    if (deviceId) {
      await db("mdm_enrolled_devices")
        .where("device_id", deviceId)
        .update({
          is_online: true,
          work_mode_enabled: isWorkModeActive !== undefined ? Boolean(isWorkModeActive) : true,
          is_compliant: isCompliant !== undefined ? Boolean(isCompliant) : true,
          last_seen: new Date(),
          updated_at: new Date()
        })
        .catch(() => {});
    }

    res.json({ success: true, message: "Telemetry recorded." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// CHANGE DEVICE POLICY
// ======================================================
router.put("/devices/:deviceId/policy", async (req, res) => {
  try {
    const { policyId } = req.body;
    const { deviceId } = req.params;

    await db("mdm_enrolled_devices")
      .where("device_id", deviceId)
      .update({ policy_id: policyId, updated_at: new Date() });

    const io = req.app.get("io");
    if (io) {
      io.to("mdm_devices").emit("mdm:command", {
        command: "SYNC_POLICY",
        deviceId,
        policyId,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      message: "Device policy updated successfully",
      data: { deviceId, policyId }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// WORK MODE TOGGLE API
// ======================================================
router.put("/devices/:deviceId/work-mode", async (req, res) => {
  try {
    const { enabled } = req.body;
    const { deviceId } = req.params;

    await db("mdm_enrolled_devices")
      .where("device_id", deviceId)
      .update({ work_mode_enabled: Boolean(enabled), updated_at: new Date() });

    const io = req.app.get("io");
    if (io) {
      io.to("mdm_devices").emit("mdm:command", {
        command: enabled ? "ENABLE_WORK_MODE" : "DISABLE_WORK_MODE",
        deviceId,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      message: enabled ? "Work Mode enabled on device" : "Work Mode disabled on device",
      data: { deviceId, workMode: Boolean(enabled) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// UNENROLL / DELETE DEVICE
// ======================================================
router.delete("/devices/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    await db("mdm_enrolled_devices").where("device_id", deviceId).update({ status: "revoked", updated_at: new Date() });

    res.json({
      success: true,
      message: "Device unenrolled from MDM successfully."
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
