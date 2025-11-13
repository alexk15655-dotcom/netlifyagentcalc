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
      data = restoreFullValuesFromTable(results.fgSummary, 'fgSummaryTable');
      filename = 'fg_summary';
      break;
    case 'fraud':
      // КРИТИЧНО: Экспортируем только выбранные чекбоксами
      const casesToExport = window.selectedCases && window.selectedCases.size > 0
        ? getSelectedFraudCases()
        : window.filteredFraudCases || results.fraudAnalysis;
      
      if (casesToExport.length === 0) {
        alert('Нет данных для экспорта. Выберите кейсы чекбоксами или примените фильтры.');
        return;
      }
      
      console.log('[Export] Экспортируем кейсов:', casesToExport.length);
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
  
  console.log('[Export] Экспортировано строк:', cleanData.length);
}

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

// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем data-caseIndex для точного соответствия
function getSelectedFraudCases() {
  const selectedCasesArray = [];
  const selectedIndices = new Set();
  
  // Собираем индексы из отмеченных чекбоксов
  document.querySelectorAll('.fraud-case-checkbox:checked').forEach(cb => {
    const caseIndex = parseInt(cb.dataset.caseIndex);
    if (!isNaN(caseIndex)) {
      selectedIndices.add(caseIndex);
    }
  });
  
  console.log('[Export] Выбранные индексы:', Array.from(selectedIndices).sort((a,b) => a-b));
  
  // Воспроизводим ТОЧНО ТОТ ЖЕ порядок, что и в рендеринге
  const grouped = { HIGH: {}, MEDIUM: {}, LOW: {} };
  
  window.filteredFraudCases.forEach(c => {
    const severity = c.severity;
    const agent = c.agentName || 'Неизвестный агент';
    
    if (!grouped[severity][agent]) {
      grouped[severity][agent] = {};
    }
    
    c.cashiers.forEach(cashierName => {
      const cashierId = extractCashierIdFromName(cashierName);
      
      if (!grouped[severity][agent][cashierId]) {
        grouped[severity][agent][cashierId] = {
          name: cashierName,
          players: []
        };
      }
      
      const existingPlayer = grouped[severity][agent][cashierId].players.find(p => 
        p.playerId === c.playerId && p.type === c.type
      );
      
      if (!existingPlayer) {
        grouped[severity][agent][cashierId].players.push(c);
      }
    });
  });
  
  let currentIndex = 0;
  
  // Проходим в ТОМ ЖЕ порядке что и renderFraudGroupedBySeverity
  ['HIGH', 'MEDIUM', 'LOW'].forEach(severity => {
    const agents = grouped[severity];
    const agentNames = Object.keys(agents).sort();
    
    agentNames.forEach(agent => {
      const cashiers = agents[agent];
      
      Object.keys(cashiers).sort().forEach(cashierId => {
        const cashierData = cashiers[cashierId];
        
        const sortedPlayers = cashierData.players.sort((a, b) => {
          const typeOrder = {
            'HIGH_WITHDRAWALS': 0,
            'HIGH_BALANCED_FLOW': 1,
            'AGENT_TAKEOVER': 2,
            'AGENT_SELF_PLAY': 3,
            'MULTI_ACCOUNTS': 4,
            'EMPTY_ACCOUNTS': 5,
            'TRASH_ACCOUNTS': 6
          };
          return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
        });
        
        sortedPlayers.forEach(fraudCase => {
          // Проверяем, выбран ли этот индекс
          if (selectedIndices.has(currentIndex)) {
            selectedCasesArray.push(fraudCase);
          }
          currentIndex++;
        });
      });
    });
  });
  
  console.log('[Export] Собрано выбранных кейсов:', selectedCasesArray.length);
  return selectedCasesArray;
}

function extractCashierIdFromName(cashierName) {
  const match = String(cashierName).match(/^(\d+)[,\s]/);
  return match ? match[1] : cashierName;
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
