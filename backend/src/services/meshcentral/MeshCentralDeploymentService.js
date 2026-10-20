const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Constructs Windows agent installers, PowerShell silent scripts, and AD GPO templates.
 */
class MeshCentralDeploymentService {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
  }

  generateEnrollmentToken(departmentId) {
    const raw = `ENROLL:${departmentId}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    return { rawToken: raw, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) };
  }

  generatePowerShellScript(tokenHash) {
    return `# NKB ITMS MeshCentral Agent Deployment Script
# Department Enrollment Token Hash: ${tokenHash}

$MeshServer = "${this.serverUrl}"
$InstallDir = "$env:ProgramFiles\\NKB-ITMS-Agent"
$AgentUrl = "$MeshServer/meshagents?id=win64"

Write-Host "Creating installation directory: $InstallDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "Downloading MeshCentral Windows Agent..."
Invoke-WebRequest -Uri $AgentUrl -OutFile "$InstallDir\\meshagent.exe"

Write-Host "Installing MeshCentral Windows Service..."
Start-Process -FilePath "$InstallDir\\meshagent.exe" -ArgumentList "-fullinstall -token ${tokenHash}" -Wait

Set-Service -Name "MeshAgent" -StartupType Automatic
Start-Service -Name "MeshAgent"
Write-Host "NKB ITMS Agent successfully deployed and service started."
`;
  }

  generateGpoGuide(tokenHash) {
    return `===================================================================
NKB ITMS - ACTIVE DIRECTORY GPO AGENT DEPLOYMENT GUIDE
===================================================================
1. Copy the PowerShell deployment script to your SYSVOL share:
   \\\\yourdomain.com\\SYSVOL\\yourdomain.com\\scripts\\Deploy-NKBAgent.ps1

2. Open Group Policy Management Console (gpmc.msc).
3. Create a new GPO: "NKB ITMS Agent Deployment GPO".
4. Edit GPO -> Computer Configuration -> Settings -> Windows Settings -> Scripts (Startup/Shutdown) -> PowerShell Scripts.
5. Add script: Deploy-NKBAgent.ps1
6. Link GPO to target Domain Workstations Organizational Units (OUs).

Enrollment Token Hash: ${tokenHash}
===================================================================`;
  }
}

module.exports = MeshCentralDeploymentService;
