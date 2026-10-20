/**
 * Base Abstract Provider Class for Remote Device Management integrations.
 */
class RemoteManagementProvider {
  constructor(name) {
    this.name = name;
  }

  async syncDevices() {
    throw new Error('syncDevices() must be implemented by subclass.');
  }

  async requestAccess(deviceId, technicianId, accessType, reason, accessMode) {
    throw new Error('requestAccess() must be implemented by subclass.');
  }

  async launchSession(deviceId, technicianId, accessMode, connectionType, reauthToken) {
    throw new Error('launchSession() must be implemented by subclass.');
  }

  async executeCommand(deviceId, technicianId, commandType, parameters, reauthToken) {
    throw new Error('executeCommand() must be implemented by subclass.');
  }

  async listFiles(deviceId, path) {
    throw new Error('listFiles() must be implemented by subclass.');
  }

  async listProcesses(deviceId) {
    throw new Error('listProcesses() must be implemented by subclass.');
  }

  async terminateProcess(deviceId, pid, reauthToken) {
    throw new Error('terminateProcess() must be implemented by subclass.');
  }

  async listServices(deviceId) {
    throw new Error('listServices() must be implemented by subclass.');
  }

  async manageService(deviceId, serviceName, action, reauthToken) {
    throw new Error('manageService() must be implemented by subclass.');
  }

  async generateAgentInstaller(departmentId, osType) {
    throw new Error('generateAgentInstaller() must be implemented by subclass.');
  }
}

module.exports = RemoteManagementProvider;
