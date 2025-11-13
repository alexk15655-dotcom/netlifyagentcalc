'use strict';

function exportCSV(tabName) {
  const results = window.cashierCheckupResults;
  if (!results) {
    alert('Нет данных для экспорта');
    return;
  }
  
  let data;
  let filename;
  
  switch (tabName) {
    case 'processed':
      data = results.grouped.filter(row => !row._separator);
      filename = 'processed_data';
      break;
    case 'fgSummary':
      // ИСПРАВЛЕНИЕ ПРОБЛЕМЫ 3: Восстанавливаем полные значения из DOM
      data = restoreFullValuesFromTable(results.fgSummary, 'fgSummaryTable');
      filename = 'fg_summary';
      break;
    case 'fraud':
      // ИСПРАВЛЕНО: Экспортируем только выбранные или все отфильтрованные
      const casesToExport = window.selectedCases && window.selectedCases.size > 0
        ? getSelectedFraudCases()
        : window.filteredFraudCases || results.fraudAnalysis;
      
      if (casesToExport.length === 0) {
        alert('Нет выбранных случаев для экспорта');
        return;
      }
      
      data = formatFraudForExport(casesToExport);
      filename = 'fraud_analysis';
      break;
    default:
      alert('Неизвестный тип данных');
      return;
  }
  
  if (!data || data.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }
  
  const cleanData = data.map(row => {
    const clean = {};
    Object.keys(row).forEach(key => {
      if (!key.startsWith('_')) {
        clean[key] = row[key];
      }
    });
    return clean;
  });
  
  const csv = Papa.unparse(cleanData, {
    delimiter: ';',
    quotes: true,
    header: true
  });
  
  const csvEuropean = csv.replace(/(\d)\.(\d)/g, '$1,$2');
  
  const blob = new Blob(['\uFEFF' + csvEuropean], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.href = url;
  link.download = `${filename}_${getTimestamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log('[Export] Экспортировано:', cleanData.length, 'строк');
}

// ИСПРАВЛЕНИЕ ПРОБЛЕМЫ 3: Восстановление полных значений из data-атрибута
function restoreFullValuesFromTable(originalData, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return originalData;
  
  const rows = table.querySelectorAll('tbody tr');
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent);
  
  const dataWithFullValues = originalData.map((row, index) => {
    const newRow = { ...row };
    const domRow = rows[index];
    
    if (domRow) {
      headers.forEach((header, colIndex) => {
        const cell = domRow.cells[colIndex];
        if (cell && cell.dataset.fullValue) {
          newRow[header] = cell.dataset.fullValue;
        }
      });
    }
    
    return newRow;
  });
  
  return dataWithFullValues;
}

// ИСПРАВЛЕНО: Используем data-атрибут из DOM для точного соответствия
function getSelectedFraudCases() {
  const selectedCasesArray = [];
  
  // Получаем все отмеченные чекбоксы
  document.querySelectorAll('.fraud-case-checkbox:checked').forEach(checkbox => {
    const caseId = checkbox.dataset.caseId;
    
    // Парсим caseId для поиска в данных
    // Формат: ${playerId}_${type}_${globalIndex}
    const parts = caseId.split('_');
    const globalIndex = parseInt(parts[parts.length - 1]);
    const type = parts.slice(1, -1).join('_');
    const playerId = parts[0];
    
    // Ищем case по совпадению всех параметров
    const fraudCase = window.filteredFraudCases.find((c, idx) => {
      return c.playerId === playerId && c.type === type;
    });
    
    if (fraudCase && !selectedCasesArray.includes(fraudCase)) {
      selectedCasesArray.push(fraudCase);
    }
  });
  
  console.log('[Export] Выбрано случаев:', selectedCasesArray.length);
  return selectedCasesArray;
}

function formatFraudForExport(fraudCases) {
  const groupedCases = {};
  
  fraudCases.forEach(fraudCase => {
    const agentName = fraudCase.agentName || 'Неизвестный агент';
    if (!groupedCases[agentName]) {
      groupedCases[agentName] = [];
    }
    groupedCases[agentName].push(fraudCase);
  });
  
  const sortedAgents = Object.keys(groupedCases).sort();
  const reportData = [];
  
  sortedAgents.forEach(agentName => {
    const cases = groupedCases[agentName].sort((a, b) => {
      const severityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    let isFirstCaseForAgent = true;
    cases.forEach(fraudCase => {
      fraudCase.cashiers.forEach((cashier) => {
        const cashierId = extractCashierId(cashier);
        
        reportData.push({
          'Агент': isFirstCaseForAgent ? agentName : '',
          '№ Кассы': cashierId,
          'ID игрока': fraudCase.playerId || '',
          'Комментарий': fraudCase.details
        });
        
        isFirstCaseForAgent = false;
      });
    });
  });
  
  return reportData;
}

function extractCashierId(cashierStr) {
  const match = String(cashierStr).match(/(\d+)[,\s]/);
  return match ? match[1] : cashierStr;
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
}
