const RemoteManagementProvider = require('./RemoteManagementProvider');
const logger = require('../../utils/logger');

/**
 * Isolated Simulation Provider for Staging/Simulation Mode.
 * Has ZERO capability to load MeshCentral credentials or execute real endpoint commands.
 */
class SimulationProvider extends RemoteManagementProvider {
  constructor() {
    super('SimulationProvider');
  }

  async syncDevices() {
    logger.info('[SimulationProvider] Emulating device sync (Simulated Data).');
    return { success: true, simulated: true, count: 5 };
  }

  async requestAccess(deviceId, technicianId, accessType, reason, accessMode) {
    logger.info(`[SimulationProvider] Emulating attended access request for device ${deviceId}`);
    return {
      success: true,
      simulated: true,
      requestCode: `REQ-SIM-${Date.now()}`,
      status: 'pending',
      expiresInSeconds: 300
    };
  }

  async launchSession(deviceId, technicianId, accessMode, connectionType, reauthToken) {
    logger.info(`[SimulationProvider] Emulating session launch for device ${deviceId}`);
    return {
      success: true,
      simulated: true,
      sessionCode: `SESS-SIM-${Date.now()}`,
      sessionUrl: `/remote-simulation-viewer?device=${deviceId}&mode=${accessMode}`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    };
  }

  async executeCommand(deviceId, technicianId, commandType, parameters, reauthToken) {
    logger.info(`[SimulationProvider] Emulating command execution '${commandType}' on device ${deviceId}`);
    return {
      success: true,
      simulated: true,
      commandCode: `CMD-SIM-${Date.now()}`,
      status: 'completed',
      exitCode: 0,
      stdout: `[SIMULATED STDOUT] Execution of '${commandType}' completed successfully on simulated target ${deviceId}.`,
      stderr: ''
    };
  }

  async listFiles(deviceId, pathStr = 'C:\\') {
    logger.info(`[SimulationProvider] Emulating file list for ${deviceId} at ${pathStr}`);
    return {
      success: true,
      simulated: true,
      path: pathStr,
      files: [
        { name: 'Program Files', isDirectory: true, sizeBytes: 0, modifiedAt: '2026-07-20 10:00:00' },
        { name: 'Windows', isDirectory: true, sizeBytes: 0, modifiedAt: '2026-07-21 14:30:00' },
        { name: 'Users', isDirectory: true, sizeBytes: 0, modifiedAt: '2026-07-22 09:15:00' },
        { name: 'NKB_ITMS_Agent_Log.txt', isDirectory: false, sizeBytes: 14200, modifiedAt: '2026-07-24 11:00:00' },
        { name: 'System_Audit_Report.pdf', isDirectory: false, sizeBytes: 524000, modifiedAt: '2026-07-24 12:30:00' }
      ]
    };
  }

  async listProcesses(deviceId) {
    logger.info(`[SimulationProvider] Emulating process list for ${deviceId}`);
    return {
      success: true,
      simulated: true,
      processes: [
        { pid: 4, name: 'System', cpuPct: 0.1, memoryMb: 12.4, user: 'NT AUTHORITY\\SYSTEM' },
        { pid: 812, name: 'explorer.exe', cpuPct: 1.2, memoryMb: 145.8, user: 'NKB\\User' },
        { pid: 1420, name: 'chrome.exe', cpuPct: 4.5, memoryMb: 520.1, user: 'NKB\\User' },
        { pid: 2890, name: 'MeshAgent.exe', cpuPct: 0.3, memoryMb: 28.5, user: 'NT AUTHORITY\\SYSTEM' },
        { pid: 3100, name: 'nkb-service.exe', cpuPct: 0.2, memoryMb: 34.2, user: 'NT AUTHORITY\\SYSTEM' }
      ]
    };
  }

  async terminateProcess(deviceId, pid, reauthToken) {
    logger.info(`[SimulationProvider] Emulating process termination pid ${pid} on ${deviceId}`);
    return {
      success: true,
      simulated: true,
      pid: pid,
      message: `[SIMULATED] Process PID ${pid} terminated.`
    };
  }

  async listServices(deviceId) {
    logger.info(`[SimulationProvider] Emulating Windows services for ${deviceId}`);
    return {
      success: true,
      simulated: true,
      services: [
        { name: 'MeshAgent', displayName: 'MeshCentral Remote Agent', status: 'Running', startupType: 'Automatic' },
        { name: 'Spooler', displayName: 'Print Spooler', status: 'Running', startupType: 'Automatic' },
        { name: 'wuauserv', displayName: 'Windows Update', status: 'Running', startupType: 'Manual' },
        { name: 'WinDefend', displayName: 'Microsoft Defender Antivirus Service', status: 'Running', startupType: 'Automatic' },
        { name: 'LanmanServer', displayName: 'Server (File Sharing)', status: 'Running', startupType: 'Automatic' }
      ]
    };
  }

  async manageService(deviceId, serviceName, action, reauthToken) {
    logger.info(`[SimulationProvider] Emulating service action ${action} on ${serviceName}`);
    return {
      success: true,
      simulated: true,
      serviceName: serviceName,
      action: action,
      status: action === 'stop' ? 'Stopped' : 'Running'
    };
  }

  async generateAgentInstaller(departmentId, osType = 'Windows') {
    const tokenHash = `SIM-TOKEN-${Date.now()}`;
    return {
      success: true,
      simulated: true,
      tokenHash,
      script: `# [SIMULATED POWERSHELL SCRIPT]\nWrite-Host "Simulated agent installer for Department ${departmentId}"`,
      gpoGuide: `[SIMULATED GPO GUIDE]\nLink GPO to target OU with Token: ${tokenHash}`
    };
  }
}

module.exports = SimulationProvider;
