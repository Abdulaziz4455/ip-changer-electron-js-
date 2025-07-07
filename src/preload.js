const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  setIPConfig: (config) => ipcRenderer.invoke('set-ip-config', config),
  toggleDHCP: (config) => ipcRenderer.invoke('toggle-dhcp', config),
  toggleAdapter: (config) => ipcRenderer.invoke('toggle-adapter', config),
  dhcpReleaseRenew: (config) => ipcRenderer.invoke('dhcp-release-renew', config),
  getPublicIp: () => ipcRenderer.invoke('get-public-ip'),
  onNetworkUpdate: (callback) => ipcRenderer.on('network-update', callback)
});