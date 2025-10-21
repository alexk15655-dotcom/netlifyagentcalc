'use strict';

// Состояние приложения
const appState = {
  mainData: null,
  prepayData: null,
  config: {
    cashierColumn: 12,  // M колонка по умолчанию
    depCommission: 5,
    withCommission: 2,
    createSummary: true,
    // Константы фрод-анализа
    fraudConfig: {
      HIGH_WITHDRAWAL_RATIO: 1.1,
      MIN_AMOUNT_FOR_ANALYSIS: 100,
      EMPTY_ACCOUNT_THRESHOLD: 10,
      NAME_SIMILARITY_THRESHOLD: 0.7
    }
  }
};

// Раскрытие расширенных настроек
function toggleAdvanced() {
  const settings = document.getElementById('advancedSettings');
  const btn = document.getElementById('advancedBtn');
  
  if (settings.style.display === 'none') {
    settings.style.display = 'block';
    btn.textContent = '▲ Скрыть настройки фрод-анализа';
  } else {
    settings.style.display = 'none';
    btn.textContent = '⚙️ Настройки фрод-анализа';
  }
}

// Инициализация
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
  
  // Обновить UI
  const filenameElement = document.getElementById(`${type}Filename`);
  filenameElement.textContent = file.name;
  filenameElement.style.color = '#667eea';
  filenameElement.style.fontWeight = '500';
  
  // Показать статус
  updateStatus(`Загрузка ${file.name}...`, 'info');
  
  // ВАЖНО: loadCSV работает ТОЛЬКО локально через FileReader
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
  
  // Константы фрод-анализа
  document.getElementById('highWithdrawalRatio').addEventListener('input', (e) => {
    appState.config.fraudConfig.HIGH_WITHDRAWAL_RATIO = parseFloat(e.target.value) / 100;
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
}

function initProcessButton() {
  document.getElementById('processBtn').addEventListener('click', processData);
}

function updateProcessButton() {
  const btn = document.getElementById('processBtn');
  btn.disabled = !appState.mainData;
}

function processData() {
  const btn = document.getElementById('processBtn');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');
  
  // UI feedback
  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';
  updateStatus('Обработка данных...', 'info');
  
  // КРИТИЧНО: Web Worker работает ЛОКАЛЬНО
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
    
    // Сохранить результаты в sessionStorage (локально в браузере)
    sessionStorage.setItem('cashierCheckupResults', JSON.stringify(results));
    
    // Перейти на страницу результатов
    window.location.href = 'results.html';
    
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
