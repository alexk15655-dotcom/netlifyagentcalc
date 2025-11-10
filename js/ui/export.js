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
      data = results.fgSummary;
      filename = 'fg_summary';
      break;
    case 'fraud':
      // Экспортируем только выбранные или все отфильтрованные
      const casesToExport = window.selectedCases && window.selectedCases.size > 0
        ? getSelectedFraudCases()
        : window.filteredFraudCases || results.fraudAnalysis;
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

function getSelectedFraudCases() {
  if (!window.filteredFraudCases) return [];
  
  const selectedIds = Array.from(window.selectedCases);
  const selectedCasesArray = [];
  
  window.filteredFraudCases.forEach((fraudCase, index) => {
    const caseId = `${fraudCase.playerId}_${fraudCase.type}_${index}`;
    if (selectedIds.includes(caseId)) {
      selectedCasesArray.push(fraudCase);
    }
  });
  
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
