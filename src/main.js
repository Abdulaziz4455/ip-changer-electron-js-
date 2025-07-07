const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const si = require('systeminformation');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true, // ✅ hides the menu bar completely
    webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    enableRemoteModule: false,
    nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    title: 'IP Manager'
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// IPC handlers for network operations
ipcMain.handle('get-network-info', async () => {
  try {
    const interfaces = await si.networkInterfaces();
    const stats = await si.networkStats();
    const defaultGateway = await si.networkGatewayDefault();
    
    return {
      interfaces: interfaces.filter(i => i.iface && i.iface !== 'lo'),
      stats,
      defaultGateway
    };
  } catch (error) {
    console.error('Error getting network info:', error);
    return { error: error.message };
  }
});

ipcMain.handle('set-ip-config', async (event, config) => {
  return new Promise((resolve, reject) => {
    const { adapter, ip, subnet, gateway, dns, altDns } = config;
    
    let commands = [];
    
    // Set static IP
    if (ip && subnet) {
      commands.push(`netsh interface ip set address name="${adapter}" static ${ip} ${subnet} ${gateway || 'none'} 1`);
    }
    
    // Set DNS
    if (dns) {
      commands.push(`netsh interface ip set dns name="${adapter}" static ${dns}`);
      if (altDns) {
        commands.push(`netsh interface ip add dns name="${adapter}" ${altDns} index=2`);
      }
    }
    
    // Execute commands
    exec(commands.join(' && '), (error, stdout, stderr) => {
      if (error) {
        console.error(`Error setting IP config: ${error.message}`);
        return reject(error.message);
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
        return reject(stderr);
      }
      resolve({ success: true, message: 'IP configuration updated successfully' });
    });
  });
});

ipcMain.handle('toggle-dhcp', async (event, { adapter, enable }) => {
  return new Promise((resolve, reject) => {
    const command = enable 
      ? `netsh interface ip set address name="${adapter}" source=dhcp && netsh interface ip set dns name="${adapter}" source=dhcp`
      : `netsh interface ip set address name="${adapter}" static 192.168.1.100 255.255.255.0 192.168.1.1`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error toggling DHCP: ${error.message}`);
        return reject(error.message);
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
        return reject(stderr);
      }
      resolve({ success: true, message: `DHCP ${enable ? 'enabled' : 'disabled'} successfully` });
    });
  });
});

ipcMain.handle('toggle-adapter', async (event, { adapter, enable }) => {
  return new Promise((resolve, reject) => {
    const command = enable
      ? `netsh interface set interface name="${adapter}" admin=enable`
      : `netsh interface set interface name="${adapter}" admin=disable`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error toggling adapter: ${error.message}`);
        return reject(error.message);
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
        return reject(stderr);
      }
      resolve({ success: true, message: `Adapter ${enable ? 'enabled' : 'disabled'} successfully` });
    });
  });
});

ipcMain.handle('dhcp-release-renew', async (event, { action, adapter }) => {
  return new Promise((resolve, reject) => {
    const command = action === 'release'
      ? `ipconfig /release "${adapter}"`
      : `ipconfig /renew "${adapter}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error ${action}ing DHCP: ${error.message}`);
        return reject(error.message);
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
        return reject(stderr);
      }
      resolve({ success: true, message: `DHCP ${action} completed successfully` });
    });
  });
});

ipcMain.handle('get-public-ip', async () => {
  return new Promise((resolve) => {
    // First try a fast endpoint
    fetch('https://api.ipify.org?format=json')
      .then(response => response.json())
      .then(data => resolve(data.ip))
      .catch(() => {
        // Fallback to a more reliable endpoint
        fetch('https://ipapi.co/json/')
          .then(response => response.json())
          .then(data => resolve(data.ip))
          .catch(() => resolve('Unable to determine'));
      });
  });
});