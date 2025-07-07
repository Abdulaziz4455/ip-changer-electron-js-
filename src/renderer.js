document.addEventListener('DOMContentLoaded', async () => {
  // Initialize UI elements
  const adapterSelect = document.getElementById('networkAdapter');
  const refreshAdaptersBtn = document.getElementById('refreshAdapters');
  const enableAdapterBtn = document.getElementById('enableAdapter');
  const disableAdapterBtn = document.getElementById('disableAdapter');
  const ipAddressInput = document.getElementById('ipAddress');
  const subnetMaskInput = document.getElementById('subnetMask');
  const gatewayInput = document.getElementById('gateway');
  const dnsInput = document.getElementById('dns');
  const altDnsInput = document.getElementById('altDns');
  const applyConfigBtn = document.getElementById('applyConfig');
  const enableDhcpBtn = document.getElementById('enableDhcp');
  const dhcpReleaseBtn = document.getElementById('dhcpRelease');
  const dhcpRenewBtn = document.getElementById('dhcpRenew');
  const updateIpBtn = document.getElementById('updateIp');
  const addQuickIpBtn = document.getElementById('addQuickIp');
  const deleteAllQuickIpBtn = document.getElementById('deleteAllQuickIp');
  const refreshIntervalSlider = document.getElementById('refreshInterval');
  const intervalValue = document.getElementById('intervalValue');
  const refreshSpeedBtn = document.getElementById('refreshSpeed');
  const networkMonitorToggle = document.getElementById('networkMonitorToggle');
  const ipProfileModal = document.getElementById('ipProfileModal');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelAddProfileBtn = document.getElementById('cancelAddProfile');
  const saveProfileBtn = document.getElementById('saveProfile');
  
  let currentAdapter = null;
  let refreshIntervalId = null;
  let monitorEnabled = true;
  let quickIpProfiles = JSON.parse(localStorage.getItem('quickIpProfiles')) || [];

  // Initialize UI
  updateLastUpdated();
  loadQuickIpProfiles();
  
  // Set up event listeners
  refreshAdaptersBtn.addEventListener('click', loadNetworkAdapters);
  enableAdapterBtn.addEventListener('click', enableCurrentAdapter);
  disableAdapterBtn.addEventListener('click', disableCurrentAdapter);
  applyConfigBtn.addEventListener('click', applyIpConfig);
  enableDhcpBtn.addEventListener('click', enableDhcp);
  dhcpReleaseBtn.addEventListener('click', () => dhcpAction('release'));
  dhcpRenewBtn.addEventListener('click', () => dhcpAction('renew'));
  updateIpBtn.addEventListener('click', updateIpAddress);
  addQuickIpBtn.addEventListener('click', showAddProfileModal);
  deleteAllQuickIpBtn.addEventListener('click', deleteAllQuickIpProfiles);
  refreshIntervalSlider.addEventListener('input', updateRefreshInterval);
  refreshSpeedBtn.addEventListener('click', refreshNetworkStats);
  networkMonitorToggle.addEventListener('change', toggleNetworkMonitor);
  closeModalBtn.addEventListener('click', hideAddProfileModal);
  cancelAddProfileBtn.addEventListener('click', hideAddProfileModal);
  saveProfileBtn.addEventListener('click', saveQuickIpProfile);
  adapterSelect.addEventListener('change', handleAdapterChange);
  
  // Load initial data
  await loadNetworkAdapters();
  await getPublicIp();
  startNetworkMonitor();

  // Listen for network updates from main process
  window.electronAPI.onNetworkUpdate((event, data) => {
    if (data.type === 'adapter-change') {
      updateAdapterDetails(data.adapter);
    } else if (data.type === 'stats-update') {
      updateNetworkStats(data.stats);
    }
  });

  // Functions
  async function loadNetworkAdapters() {
    try {
      const networkInfo = await window.electronAPI.getNetworkInfo();
      adapterSelect.innerHTML = '';
      
      if (networkInfo.interfaces.length === 0) {
        adapterSelect.innerHTML = '<option value="">No network adapters found</option>';
        return;
      }
      
      networkInfo.interfaces.forEach(adapter => {
        const option = document.createElement('option');
        option.value = adapter.iface;
        option.textContent = `${adapter.ifaceName} (${adapter.iface})`;
        option.dataset.details = JSON.stringify(adapter);
        
        if (adapter.operstate === 'up') {
          option.selected = true;
          currentAdapter = adapter;
          updateAdapterDetails(adapter);
        }
        
        adapterSelect.appendChild(option);
      });
      
      updateConnectionStatus(true);
    } catch (error) {
      console.error('Error loading network adapters:', error);
      updateConnectionStatus(false, error.message);
    }
  }

  function handleAdapterChange() {
    const selectedOption = adapterSelect.options[adapterSelect.selectedIndex];
    if (selectedOption && selectedOption.value) {
      currentAdapter = JSON.parse(selectedOption.dataset.details);
      updateAdapterDetails(currentAdapter);
    }
  }

  function updateAdapterDetails(adapter) {
    document.getElementById('macAddress').textContent = adapter.mac || '-';
    
    const statusElement = document.getElementById('networkStatus');
    statusElement.textContent = adapter.operstate === 'up' ? 'Connected' : 'Disconnected';
    statusElement.className = adapter.operstate === 'up' ? 'text-success' : 'text-danger';
    
    const dhcpElement = document.getElementById('dhcpStatus');
    const isDhcp = adapter.dhcp === true || adapter.dhcp === 'true';
    dhcpElement.textContent = isDhcp ? 'Enabled' : 'Disabled';
    dhcpElement.className = isDhcp ? 'bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium' : 'bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium';
    
    // Update form fields with current IP config
    if (adapter.ip4) {
      ipAddressInput.value = adapter.ip4;
      subnetMaskInput.value = adapter.netmask || '255.255.255.0';
    }
    
    if (adapter.gateway) {
      gatewayInput.value = adapter.gateway;
    }
  }

  async function getPublicIp() {
    try {
      const publicIp = await window.electronAPI.getPublicIp();
      document.getElementById('wanIp').textContent = publicIp;
    } catch (error) {
      console.error('Error getting public IP:', error);
      document.getElementById('wanIp').textContent = 'Error fetching';
    }
  }

  function updateNetworkStats(stats) {
    if (!stats || stats.length === 0) return;
    
    // Find stats for current adapter
    const adapterStats = stats.find(s => s.iface === currentAdapter?.iface) || stats[0];
    
    if (adapterStats) {
      document.getElementById('downloadSpeed').textContent = 
        `${(adapterStats.rx_sec / 1024).toFixed(1)} KB/s`;
      document.getElementById('uploadSpeed').textContent = 
        `${(adapterStats.tx_sec / 1024).toFixed(1)} KB/s`;
    }
    
    updateLastUpdated();
  }

  function startNetworkMonitor() {
    if (refreshIntervalId) clearInterval(refreshIntervalId);
    
    const interval = parseInt(refreshIntervalSlider.value);
    refreshIntervalId = setInterval(async () => {
      if (monitorEnabled) {
        const networkInfo = await window.electronAPI.getNetworkInfo();
        updateNetworkStats(networkInfo.stats);
      }
    }, interval);
  }

  function updateRefreshInterval() {
    intervalValue.textContent = `${refreshIntervalSlider.value} ms`;
    startNetworkMonitor();
  }

  function toggleNetworkMonitor() {
    monitorEnabled = networkMonitorToggle.checked;
  }

  function refreshNetworkStats() {
    if (monitorEnabled) {
      window.electronAPI.getNetworkInfo().then(networkInfo => {
        updateNetworkStats(networkInfo.stats);
      });
    }
  }

  function updateLastUpdated() {
    const now = new Date();
    document.getElementById('lastUpdated').textContent = 
      `Last updated: ${now.toLocaleTimeString()}`;
  }

  function updateConnectionStatus(connected, message) {
    const statusElement = document.getElementById('connectionStatus');
    const dot = statusElement.querySelector('span');
    
    if (connected) {
      dot.className = 'h-2 w-2 rounded-full bg-green-400';
      statusElement.querySelector('span:last-child').textContent = 'Connected';
    } else {
      dot.className = 'h-2 w-2 rounded-full bg-red-400';
      statusElement.querySelector('span:last-child').textContent = message || 'Disconnected';
    }
  }

  async function enableCurrentAdapter() {
    if (!currentAdapter) return;
    
    try {
      await window.electronAPI.toggleAdapter({
        adapter: currentAdapter.iface,
        enable: true
      });
      
      updateConnectionStatus(true);
      document.getElementById('networkStatus').textContent = 'Connected';
      document.getElementById('networkStatus').className = 'text-success';
      
      // Refresh adapter list after a short delay
      setTimeout(loadNetworkAdapters, 1000);
    } catch (error) {
      console.error('Error enabling adapter:', error);
      updateConnectionStatus(false, error.message);
    }
  }

  async function disableCurrentAdapter() {
    if (!currentAdapter) return;
    
    try {
      await window.electronAPI.toggleAdapter({
        adapter: currentAdapter.iface,
        enable: false
      });
      
      updateConnectionStatus(false, 'Adapter disabled');
      document.getElementById('networkStatus').textContent = 'Disconnected';
      document.getElementById('networkStatus').className = 'text-danger';
      
      // Refresh adapter list after a short delay
      setTimeout(loadNetworkAdapters, 1000);
    } catch (error) {
      console.error('Error disabling adapter:', error);
      updateConnectionStatus(false, error.message);
    }
  }

  async function applyIpConfig() {
    if (!currentAdapter) return;
    
    const config = {
      adapter: currentAdapter.iface,
      ip: ipAddressInput.value,
      subnet: subnetMaskInput.value,
      gateway: gatewayInput.value,
      dns: dnsInput.value,
      altDns: altDnsInput.value || ''
    };
    
    try {
      await window.electronAPI.setIPConfig(config);
      showToast('IP configuration applied successfully', 'success');
      
      // Refresh adapter details after a short delay
      setTimeout(async () => {
        await loadNetworkAdapters();
        await getPublicIp();
      }, 1000);
    } catch (error) {
      console.error('Error applying IP config:', error);
      showToast(`Error: ${error.message}`, 'danger');
    }
  }

  async function updateIpAddress() {
    if (!currentAdapter) return;
    
    const config = {
      adapter: currentAdapter.iface,
      ip: ipAddressInput.value,
      subnet: subnetMaskInput.value,
      gateway: gatewayInput.value || currentAdapter.gateway || '',
      dns: dnsInput.value || currentAdapter.dns || '8.8.8.8',
      altDns: altDnsInput.value || currentAdapter.altDns || '8.8.4.4'
    };
    
    try {
      await window.electronAPI.setIPConfig(config);
      showToast('IP address updated successfully', 'success');
      
      // Refresh adapter details after a short delay
      setTimeout(async () => {
        await loadNetworkAdapters();
        await getPublicIp();
      }, 1000);
    } catch (error) {
      console.error('Error updating IP:', error);
      showToast(`Error: ${error.message}`, 'danger');
    }
  }

  async function enableDhcp() {
    if (!currentAdapter) return;
    
    try {
      await window.electronAPI.toggleDHCP({
        adapter: currentAdapter.iface,
        enable: true
      });
      
      showToast('DHCP enabled successfully', 'success');
      document.getElementById('dhcpStatus').textContent = 'Enabled';
      document.getElementById('dhcpStatus').className = 'bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium';
      
      // Refresh adapter details after a short delay
      setTimeout(async () => {
        await loadNetworkAdapters();
        await getPublicIp();
      }, 1000);
    } catch (error) {
      console.error('Error enabling DHCP:', error);
      showToast(`Error: ${error.message}`, 'danger');
    }
  }

  async function dhcpAction(action) {
    if (!currentAdapter) return;
    
    try {
      await window.electronAPI.dhcpReleaseRenew({
        adapter: currentAdapter.iface,
        action: action
      });
      
      showToast(`DHCP ${action} completed successfully`, 'success');
      
      // Refresh adapter details after a short delay
      setTimeout(async () => {
        await loadNetworkAdapters();
        await getPublicIp();
      }, 2000);
    } catch (error) {
      console.error(`Error ${action}ing DHCP:`, error);
      showToast(`Error: ${error.message}`, 'danger');
    }
  }

  function showAddProfileModal() {
    // Pre-fill form with current values
    document.getElementById('profileName').value = '';
    document.getElementById('profileIp').value = ipAddressInput.value;
    document.getElementById('profileSubnet').value = subnetMaskInput.value;
    document.getElementById('profileGateway').value = gatewayInput.value;
    document.getElementById('profileDns').value = dnsInput.value;
    document.getElementById('profileAltDns').value = altDnsInput.value;
    
    ipProfileModal.classList.remove('hidden');
  }

  function hideAddProfileModal() {
    ipProfileModal.classList.add('hidden');
  }

  function saveQuickIpProfile() {
    const profile = {
      name: document.getElementById('profileName').value.trim(),
      ip: document.getElementById('profileIp').value.trim(),
      subnet: document.getElementById('profileSubnet').value.trim(),
      gateway: document.getElementById('profileGateway').value.trim(),
      dns: document.getElementById('profileDns').value.trim(),
      altDns: document.getElementById('profileAltDns').value.trim()
    };
    
    if (!profile.name || !profile.ip) {
      showToast('Profile name and IP address are required', 'warning');
      return;
    }
    
    quickIpProfiles.push(profile);
    localStorage.setItem('quickIpProfiles', JSON.stringify(quickIpProfiles));
    loadQuickIpProfiles();
    hideAddProfileModal();
    showToast('Profile saved successfully', 'success');
  }

  function loadQuickIpProfiles() {
    const quickIpList = document.getElementById('quickIpList');
    quickIpList.innerHTML = '';
    
    if (quickIpProfiles.length === 0) {
      quickIpList.innerHTML = `
        <tr>
          <td colspan="7" class="px-4 py-4 text-center text-gray-500">
            No IP profiles saved
          </td>
        </tr>
      `;
      return;
    }
    
    quickIpProfiles.forEach((profile, index) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';
      row.innerHTML = `
        <td class="px-4 py-2">${profile.name}</td>
        <td class="px-4 py-2">${profile.ip}</td>
        <td class="px-4 py-2">${profile.subnet}</td>
        <td class="px-4 py-2">${profile.gateway || '-'}</td>
        <td class="px-4 py-2">${profile.dns || '-'}</td>
        <td class="px-4 py-2">${profile.altDns || '-'}</td>
        <td class="px-4 py-2">
          <div class="flex gap-2">
            <button class="apply-profile px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs hover:bg-blue-200" data-index="${index}">
              Apply
            </button>
            <button class="delete-profile px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200" data-index="${index}">
              Delete
            </button>
          </div>
        </td>
      `;
      
      quickIpList.appendChild(row);
    });
    
    // Add event listeners to new buttons
    document.querySelectorAll('.apply-profile').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = e.target.dataset.index;
        applyQuickIpProfile(index);
      });
    });
    
    document.querySelectorAll('.delete-profile').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = e.target.dataset.index;
        deleteQuickIpProfile(index);
      });
    });
  }

  function applyQuickIpProfile(index) {
    const profile = quickIpProfiles[index];
    if (!profile) return;
    
    ipAddressInput.value = profile.ip;
    subnetMaskInput.value = profile.subnet;
    gatewayInput.value = profile.gateway || '';
    dnsInput.value = profile.dns || '8.8.8.8';
    altDnsInput.value = profile.altDns || '8.8.4.4';
    
    showToast(`Profile "${profile.name}" loaded`, 'success');
  }

  function deleteQuickIpProfile(index) {
    quickIpProfiles.splice(index, 1);
    localStorage.setItem('quickIpProfiles', JSON.stringify(quickIpProfiles));
    loadQuickIpProfiles();
    showToast('Profile deleted', 'success');
  }

  function deleteAllQuickIpProfiles() {
    if (quickIpProfiles.length === 0) return;
    
    if (confirm('Are you sure you want to delete all saved IP profiles?')) {
      quickIpProfiles = [];
      localStorage.removeItem('quickIpProfiles');
      loadQuickIpProfiles();
      showToast('All profiles deleted', 'success');
    }
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-4 py-2 rounded-md shadow-lg text-white ${
      type === 'success' ? 'bg-green-500' : 
      type === 'danger' ? 'bg-red-500' : 
      type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
    }`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
});