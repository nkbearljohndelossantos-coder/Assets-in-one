const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let PORT = parseInt(process.env.MDM_PORT || process.env.PORT || 3000, 10);

// Import Production-Ready MDM Router
const mdmRouter = require("./src/routes/mdm");
app.use("/", mdmRouter);
app.use("/api/mdm", mdmRouter);

function startServer(portToUse) {
  const server = app.listen(portToUse, () => {
    console.log(`
========================================
 NKB MANUFACTURING ENTERPRISE MDM
========================================

Server : http://localhost:${portToUse}
Status : ONLINE (Production-Ready Universal QR Scanner & Policy Security)

MDM API:
GET    /api/mdm/health
GET    /api/mdm/devices
GET    /api/mdm/policies

POST   /api/mdm/enrollment/create    (Generates 100% Universal Smartphone Camera Scannable QR)
GET    /api/mdm/enrollment/scan      (Public Smartphone Camera Validation UI)
POST   /api/mdm/enrollment/complete  (Enrolls Device & Applies Security Policies)

PUT    /api/mdm/devices/:deviceId/policy
PUT    /api/mdm/devices/:deviceId/work-mode

DELETE /api/mdm/devices/:deviceId
========================================
`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[MDM Server] Port ${portToUse} is in use. Attempting fallback port ${portToUse + 1}...`);
      startServer(portToUse + 1);
    } else {
      console.error("[MDM Server Error]", err);
    }
  });
}

startServer(PORT);
