'use strict';

const appState = {
  mainData: null,
  prepayData: null,
  config: {
    cashierColumn: 12,
    depCommission: 5,
    withCommission: 2,
    createSummary: true,
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
      NAME_SIMILARITY_MULTI: 0.8
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

document.addEventListener('DOMContentLoaded', () => {
  initFileInputs();
  initConfigInputs();
  initProcessButton();
});

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
  
  // Расширенные настройки - новые параметры
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
}

function initProcessButton() {
  document.getElementById('processBtn').addEventListener('click', processData);
}

function updateProcessButton() {
  const btn = document.getElementById('processBtn');
  btn.disabled = !appState.mainData;
}

// IndexedDB для больших данных
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

function saveResults(results) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['results'], 'readwrite');
      const store = transaction.objectStore('results');
      const request = store.put(results, 'lastProcessing');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  });
}

function processData() {
  const btn = document.getElementById('processBtn');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');
  
  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';
  updateStatus('Обработка данных...', 'info');
  
  const worker = new Worker('js/workers/main.worker.js');
  
  worker.postMessage({
    mainData: appState.mainData,
    prepayData: appState.prepayData,
    config: appState.config
  });
  
  worker.onmessage = (e) => {
    const results = e.data;
    
    if (results.error) {
      updateStatus(`✗ Ошибка: ${results.error}`, 'error');
      btn.disabled = false;
      btnText.style.display = 'inline';
      btnLoader.style.display = 'none';
      return;
    }
    
    // Сохраняем в IndexedDB вместо sessionStorage
    saveResults(results)
      .then(() => {
        window.location.href = 'results.html';
      })
      .catch(error => {
        updateStatus(`✗ Ошибка сохранения: ${error.message}`, 'error');
        btn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
      });
    
    worker.terminate();
  };
  
  worker.onerror = (error) => {
    updateStatus(`✗ Ошибка обработки: ${error.message}`, 'error');
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
    worker.terminate();
  };
}

function updateStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status status-${type}`;
}
