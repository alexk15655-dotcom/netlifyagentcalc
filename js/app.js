'use strict';

const appState = {
  mainData: null,
  prepayData: null,
  config: {
    cashierColumn: 12,
    depCommission: 5,
    withCommission: 2,
    createSummary: true,
    findSimilarNames: false,
    fraudConfig: {
      MIN_WITHDRAWAL_DIFF: 100,
      MEDIUM_RATIO: 1.1,
      HIGH_RATIO: 2.0,
      HIGH_DIFF: 1000,
      MIN_AMOUNT_FOR_ANALYSIS: 100,
      EMPTY_ACCOUNT_THRESHOLD: 10,
      NAME_SIMILARITY_THRESHOLD: 0.7,
      MULTI_ACCOUNT_THRESHOLD: 3,
      MULTI_ACCOUNT_LOW_LOSS: 75,
      MULTI_ACCOUNT_MEDIUM_LOSS: 150,
      MULTI_ACCOUNT_MEDIUM_COUNT: 5,
      MULTI_ACCOUNT_HIGH_LOSS: 500,
      MULTI_ACCOUNT_HIGH_COUNT: 10,
      NAME_SIMILARITY_MULTI: 0.8,
      HIGH_BALANCED_FLOW_DETECTION_THRESHOLD: 1000,
      HIGH_BALANCED_FLOW_HIGH_THRESHOLD: 5000,
      HIGH_BALANCED_FLOW_LOWER_RATIO: 0.90,
      AGENT_TAKEOVER_MIN_DEPOSITS: 1000,
      AGENT_TAKEOVER_MAX_PLAYERS: 10,
      AGENT_TAKEOVER_CONCENTRATION: 0.80,
      AGENT_TAKEOVER_MAX_GROUP_SIZE: 3,
      AGENT_TAKEOVER_MEDIUM_THRESHOLD: 200,
      AGENT_TAKEOVER_HIGH_THRESHOLD: 500
    }
  }
};

function toggleAdvanced() {
  const settings = document.getElementById('advancedSettings');
  const btn = document.getElementById('advancedBtn');
  
  if (settings.style.display === 'none') {
    settings.style.display = 'block';
    btn.textContent = '▲ Скрыть расширенные настройки';
  } else {
    settings.style.display = 'none';
    btn.textContent = '⚙️ Расширенные настройки';
  }
}

// ПУНКТ 7: Функция toggle для accordion секций
function toggleSection(sectionId) {
  const content = document.getElementById(`section-${sectionId}`);
  const toggle = document.getElementById(`toggle-${sectionId}`);
  
  if (!content || !toggle) return;
  
  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    toggle.textContent = '▼';
    localStorage.setItem(`section-${sectionId}`, 'open');
  } else {
    content.classList.add('collapsed');
    toggle.textContent = '▶';
    localStorage.setItem(`section-${sectionId}`, 'closed');
  }
}

// ПУНКТ 7: Валидация настроек
function validateFraudSettings() {
  let isValid = true;
  
  clearAllValidationErrors();
  
  const balancedFlowLower = parseFloat(document.getElementById('balancedFlowLowerRatio').value);
  const mediumRatio = parseFloat(document.getElementById('mediumRatio').value);
  
  if (balancedFlowLower >= mediumRatio) {
    showValidationError('balancedFlowLowerRatio', 
      'Нижний порог должен быть меньше MEDIUM порога Высоких выводов');
    isValid = false;
  }
  
  const mediumLoss = parseFloat(document.getElementById('multiAccountMediumLoss').value);
  const highLoss = parseFloat(document.getElementById('multiAccountHighLoss').value);
  
  if (mediumLoss >= highLoss) {
    showValidationError('multiAccountMediumLoss', 
      'MEDIUM порог должен быть меньше HIGH порога');
    isValid = false;
  }
  
  const mediumCount = parseInt(document.getElementById('multiAccountMediumCount').value);
  const highCount = parseInt(document.getElementById('multiAccountHighCount').value);
  const threshold = parseInt(document.getElementById('multiAccountThreshold').value);
  
  if (mediumCount < threshold) {
    showValidationError('multiAccountMediumCount', 
      'MEDIUM кол-во должно быть >= минимального порога');
    isValid = false;
  }
  
  if (highCount < mediumCount) {
    showValidationError('multiAccountHighCount', 
      'HIGH кол-во должно быть >= MEDIUM кол-ва');
    isValid = false;
  }
  
  const balancedDetection = parseFloat(document.getElementById('balancedFlowDetectionThreshold').value);
  const balancedHigh = parseFloat(document.getElementById('balancedFlowHighThreshold').value);
  
  if (balancedHigh < balancedDetection) {
    showValidationError('balancedFlowHighThreshold', 
      'HIGH порог должен быть >= минимального депозита');
    isValid = false;
  }
  
  const takeoverMedium = parseFloat(document.getElementById('takeoverMediumThreshold').value);
  const takeoverHigh = parseFloat(document.getElementById('takeoverHighThreshold').value);
  
  if (takeoverHigh < takeoverMedium) {
    showValidationError('takeoverHighThreshold', 
      'HIGH порог должен быть >= MEDIUM порога');
    isValid = false;
  }
  
  return isValid;
}

function showValidationError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  const item = field.closest('.config-item');
  if (!item) return;
  
  item.classList.add('invalid');
  
  let errorDiv = item.querySelector('.validation-error');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.className = 'validation-error';
    item.appendChild(errorDiv);
  }
  errorDiv.textContent = message;
}

function clearValidationError(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  const item = field.closest('.config-item');
  if (!item) return;
  
  item.classList.remove('invalid');
  const errorDiv = item.querySelector('.validation-error');
  if (errorDiv) {
    errorDiv.textContent = '';
  }
}

function clearAllValidationErrors() {
  document.querySelectorAll('.config-item.invalid').forEach(item => {
    item.classList.remove('invalid');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initFileInputs();
  initConfigInputs();
  initProcessButton();
  restoreAccordionState();
  initValidation();
});

// ПУНКТ 7: Восстановление состояния accordion
function restoreAccordionState() {
  const sections = [
    'highWithdrawals', 
    'balancedFlow', 
    'agentSelfPlay', 
    'emptyAccounts', 
    'multiAccounts', 
    'agentTakeover'
  ];
  
  sections.forEach(sectionId => {
    const state = localStorage.getItem(`section-${sectionId}`);
    const content = document.getElementById(`section-${sectionId}`);
    const toggle = document.getElementById(`toggle-${sectionId}`);
    
    if (!content || !toggle) return;
    
    if (state === 'closed') {
      content.classList.add('collapsed');
      toggle.textContent = '▶';
    } else {
      content.classList.remove('collapsed');
      toggle.textContent = '▼';
    }
  });
}

// ПУНКТ 7: Инициализация валидации
function initValidation() {
  const fieldsToValidate = [
    'balancedFlowLowerRatio',
    'mediumRatio',
    'multiAccountMediumLoss',
    'multiAccountHighLoss',
    'multiAccountMediumCount',
    'multiAccountHighCount',
    'multiAccountThreshold',
    'balancedFlowDetectionThreshold',
    'balancedFlowHighThreshold',
    'takeoverMediumThreshold',
    'takeoverHighThreshold'
  ];
  
  fieldsToValidate.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', () => {
        clearValidationError(fieldId);
        setTimeout(validateFraudSettings, 300);
      });
    }
  });
}

function initFileInputs() {
  const mainFile = document.getElementById('mainFile');
  const prepayFile = document.getElementById('prepayFile');
  
  mainFile.addEventListener('change', (e) => handleFileSelect(e, 'main'));
  prepayFile.addEventListener('change', (e) => handleFileSelect(e, 'prepay'));
}

function handleFileSelect(event, type) {
  const file = event.target.files[0];
  if (!file) return;
  
  const filenameElement = document.getElementById(`${type}Filename`);
  filenameElement.textContent = file.name;
  filenameElement.style.color = '#667eea';
  filenameElement.style.fontWeight = '500';
  
  updateStatus(`Загрузка ${file.name}...`, 'info');
  
  loadCSV(file, (data) => {
    if (type === 'main') {
      appState.mainData = data;
      updateStatus(`✓ ${file.name} загружен (${data.length} строк)`, 'success');
    } else {
      appState.prepayData = data;
      updateStatus(`✓ ${file.name} загружен (${data.length} строк)`, 'success');
    }
    
    updateProcessButton();
  }, (error) => {
    updateStatus(`✗ Ошибка загрузки: ${error}`, 'error');
  });
}

function initConfigInputs() {
  document.getElementById('cashierColumn').addEventListener('change', (e) => {
    appState.config.cashierColumn = parseInt(e.target.value);
  });
  
  document.getElementById('depCommission').addEventListener('input', (e) => {
    appState.config.depCommission = parseFloat(e.target.value);
  });
  
  document.getElementById('withCommission').addEventListener('input', (e) => {
    appState.config.withCommission = parseFloat(e.target.value);
  });
  
  document.getElementById('createSummary').addEventListener('change', (e) => {
    appState.config.createSummary = e.target.checked;
  });
  
  document.getElementById('findSimilarNames').addEventListener('change', (e) => {
    appState.config.findSimilarNames = e.target.checked;
  });
  
  document.getElementById('minWithdrawalDiff').addEventListener('input', (e) => {
    appState.config.fraudConfig.MIN_WITHDRAWAL_DIFF = parseFloat(e.target.value);
  });
  
  document.getElementById('mediumRatio').addEventListener('input', (e) => {
    appState.config.fraudConfig.MEDIUM_RATIO = parseFloat(e.target.value) / 100;
  });
  
  document.getElementById('highRatio').addEventListener('input', (e) => {
    appState.config.fraudConfig.HIGH_RATIO = parseFloat(e.target.value) / 100;
  });
  
  document.getElementById('highDiff').addEventListener('input', (e) => {
    appState.config.fraudConfig.HIGH_DIFF = parseFloat(e.target.value);
  });
  
  document.getElementById('minAmountAnalysis').addEventListener('input', (e) => {
    appState.config.fraudConfig.MIN_AMOUNT_FOR_ANALYSIS = parseFloat(e.target.value);
  });
  
  document.getElementById('emptyAccountThreshold').addEventListener('input', (e) => {
    appState.config.fraudConfig.EMPTY_ACCOUNT_THRESHOLD = parseInt(e.target.value);
  });
  
  document.getElementById('nameSimilarityThreshold').addEventListener('input', (e) => {
    appState.config.fraudConfig.NAME_SIMILARITY_THRESHOLD = parseFloat(e.target.value) / 100;
  });
  
  document.getElementById('multiAccountThreshold').addEventListener('input', (e) => {
    appState.config.fraudConfig.MULTI_ACCOUNT_THRESHOLD = parseInt(e.target.value);
  });
  
  document.getElementById('multiAccountLowLoss').addEventListener('input', (e) => {
    appState.config.fraudConfig.MULTI_ACCOUNT_LOW_LOSS = parseFloat(e.target.value);
  });
  
  document.getElementById('multiAccountMediumLoss').addEventListener('input', (e) => {
    appState.config.fraudConfig.MULTI_ACCOUNT_MEDIUM_LOSS = parseFloat(e.target.value);
  });
  
  document.getElementById('multiAccountMediumCount').addEventListener('input', (e) => {
    appState.config.fraudConfig.MULTI_ACCOUNT_MEDIUM_COUNT = parseInt(e.target.value);
  });
  
  document.getElementById('multiAccountHighLoss').addEventListener('input', (e) => {
    appState.config.fraudConfig.MULTI_ACCOUNT_HIGH_LOSS = parseFloat(e.target.value);
  });
  
  document.getElementById('multiAccountHighCount').addEventListener('input', (e) => {
    appState.config.fraudConfig.MULTI_ACCOUNT_HIGH_COUNT = parseInt(e.target.value);
  });
  
  document.getElementById('nameSimilarityMulti').addEventListener('input', (e) => {
    appState.config.fraudConfig.NAME_SIMILARITY_MULTI = parseFloat(e.target.value) / 100;
  });
  
  document.getElementById('balancedFlowDetectionThreshold').addEventListener('input', (e) => {
    appState.config.fraudConfig.HIGH_BALANCED_FLOW_DETECTION_THRESHOLD = parseFloat(e.target.value);
  });
  
  document.getElementById('balancedFlowHighThreshold').addEventListener('input', (e) => {
    appState.config.fraudConfig.HIGH_BALANCED_FLOW_HIGH_THRESHOLD = parseFloat(e.target.value);
  });
  
  document.getElementById('balancedFlowLowerRatio').addEventListener('input', (e) => {
    appState.config.fraudConfig.HIGH_BALANCED_FLOW_LOWER_RATIO = parseFloat(e.target.value) / 100;
  });
  
  document.getElementById('takeoverMinDeposits').addEventListener('input', (e) => {
    appState.config.fraudConfig.AGENT_TAKEOVER_MIN_DEPOSITS = parseFloat(e.target.value);
  });
  
  document.getElementById('takeoverMaxPlayers').addEventListener('input', (e) => {
    appState.config.fraudConfig.AGENT_TAKEOVER_MAX_PLAYERS = parseInt(e.target.value);
  });
  
  document.getElementById('takeoverConcentration').addEventListener('input', (e) => {
    appState.config.fraudConfig.AGENT_TAKEOVER_CONCENTRATION = parseFloat(e.target.value) / 100;
  });
  
  document.getElementById('takeoverMaxGroupSize').addEventListener('input', (e) => {
    appState.config.fraudConfig.AGENT_TAKEOVER_MAX_GROUP_SIZE = parseInt(e.target.value);
  });
  
  document.getElementById('takeoverMediumThreshold').addEventListener('input', (e) => {
    appState.config.fraudConfig.AGENT_TAKEOVER_MEDIUM_THRESHOLD = parseFloat(e.target.value);
  });
  
  document.getElementById('takeoverHighThreshold').addEventListener('input', (e) => {
    appState.config.fraudConfig.AGENT_TAKEOVER_HIGH_THRESHOLD = parseFloat(e.target.value);
  });
}

function initProcessButton() {
  document.getElementById('processBtn').addEventListener('click', processData);
}

function updateProcessButton() {
  const btn = document.getElementById('processBtn');
  btn.disabled = !appState.mainData;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CashierCheckupDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('results')) {
        db.createObjectStore('results');
      }
    };
  });
}

async function saveResults(data) {
  try {
    const db = await openDB();
    const tx = db.transaction('results', 'readwrite');
    const store = tx.objectStore('results');
    
    await store.put(data.fgSummary || [], 'fgSummary');
    await store.put(data.grouped || [], 'grouped');
    await store.put(data.fraudAnalysis || [], 'fraudAnalysis');
    await store.put(data.config || {}, 'config');
    await store.put(data.timestamp || new Date().toISOString(), 'timestamp');
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log('[App] Данные сохранены в IndexedDB');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('[App] Ошибка сохранения в IndexedDB:', error);
    throw error;
  }
}

async function processData() {
  if (!appState.mainData) {
    alert('Загрузите основной файл');
    return;
  }
  
  // ПУНКТ 7: Валидация перед обработкой
  if (!validateFraudSettings()) {
    updateStatus('✗ Исправьте ошибки в настройках', 'error');
    return;
  }
  
  const btn = document.getElementById('processBtn');
  btn.disabled = true;
  btn.textContent = 'Обработка...';
  updateStatus('Обработка данных...', 'info');
  
  try {
    const worker = new Worker('js/workers/main.worker.js');
    
    worker.onmessage = async (e) => {
      const result = e.data;
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log('[App] Результаты получены:', {
        processed: result.processed?.length,
        grouped: result.grouped?.length,
        fraud: result.fraudAnalysis?.length,
        fgSummary: result.fgSummary?.length
      });
      
      await saveResults(result);
      
      updateStatus('✓ Обработка завершена!', 'success');
      
      setTimeout(() => {
        window.location.href = 'results.html';
      }, 500);
      
      worker.terminate();
    };
    
    worker.onerror = (error) => {
      throw error;
    };
    
    worker.postMessage({
      mainData: appState.mainData,
      prepayData: appState.prepayData,
      config: appState.config
    });
    
  } catch (error) {
    console.error('[App] Ошибка:', error);
    updateStatus(`✗ Ошибка: ${error.message}`, 'error');
    btn.disabled = false;
    btn.textContent = '🔄 Обработать';
  }
}

function updateStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status status-${type}`;
}
