'use strict';

function createFGSummary(groupedData, prepayData) {
  console.log('[FG Summary] Создание сводки');
  
  if (!groupedData || groupedData.length === 0) {
    return null;
  }
  
  const fgRows = groupedData.filter(row => row._isFG);
  
  if (fgRows.length === 0) {
    console.warn('[FG Summary] Строки ФГ не найдены');
    return null;
  }
  
  const headers = Object.keys(fgRows[0]);
  const cashierKey = fgRows[0]._cashierColumn;
  
  // Группируем строки ФГ по имени ФГ
  const fgGroups = {};
  
  fgRows.forEach(fgRow => {
    const col0 = String(fgRow[headers[0]] || '');
    const col1 = String(fgRow[headers[1]] || '');
    
    let fgName = '';
    let cashierInfo = '';
    
    if (col0.startsWith('ФГ:')) {
      fgName = col0.substring(3).trim();
      cashierInfo = col1;
    } else if (col1.startsWith('ФГ:')) {
      fgName = col1.substring(3).trim();
      cashierInfo = col0;
    }
    
    if (!fgName) return;
    
    // Инициализируем группу если её нет
    if (!fgGroups[fgName]) {
      fgGroups[fgName] = {
        fgName: fgName,
        cashiers: [],
        cashierIds: [],
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalCommission: 0,
        totalProfit: 0,
        depositCounts: [],
        withdrawalCounts: [],
        deposits: [],
        withdrawals: []
      };
    }
    
    const group = fgGroups[fgName];
    
    // Добавляем кассу
    const fullCashierName = String(fgRow[cashierKey] || cashierInfo).trim();
    group.cashiers.push(fullCashierName);
    
    const cashierId = extractCashierId(fullCashierName);
    group.cashierIds.push(cashierId);
    
    // Суммируем данные
    const parseNum = (val) => parseFloat(String(val).replace(/[\s,]/g, '')) || 0;
    
    group.totalDeposits += parseNum(
      fgRow['Сумма пополнений (в валюте админа по курсу текущего дня)'] ||
      fgRow['Сумма пополнений (в валюте админа)'] || 0
    );
    
    group.totalWithdrawals += parseNum(
      fgRow['Сумма вывода (в валюте админа по курсу текущего дня)'] ||
      fgRow['Сумма вывода (в валюте админа)'] || 0
    );
    
    const depCount = parseNum(fgRow['Количество пополнений'] || 0);
    const withCount = parseNum(fgRow['Количество выводов'] || 0);
    
    if (depCount > 0) group.depositCounts.push(depCount);
    if (withCount > 0) group.withdrawalCounts.push(withCount);
    
    group.totalCommission += parseNum(fgRow['Комиссия'] || 0);
    group.totalProfit += parseNum(fgRow['Профит'] || 0);
    
    // Средние депозиты/выводы
    const avgDep = parseNum(fgRow['Средний депозит'] || 0);
    const avgWith = parseNum(fgRow['Средний вывод'] || 0);
    
    if (avgDep > 0) group.deposits.push(avgDep);
    if (avgWith > 0) group.withdrawals.push(avgWith);
  });
  
  // Формируем итоговую сводку
  const summary = [];
  
  Object.values(fgGroups).forEach(group => {
    // Получаем prepayment
    let prepaidAmount = 0;
    if (prepayData && prepayData.length > 0) {
      const prepayRow = prepayData.find(p => {
        const prepayFG = String(p['Фин. группа'] || p['Финансовая группа'] || '').trim();
        return prepayFG.includes(group.fgName) || group.fgName.includes(prepayFG);
      });
      
      if (prepayRow) {
        prepaidAmount = parseFloat(
          String(prepayRow['Сумма пополнений (в валюте админа)'] || 
                 prepayRow['Сумма пополнений'] || 0).replace(/[\s,]/g, '')
        ) || 0;
      }
    }
    
    // Считаем количество игроков
    const playerCount = countPlayersForCashiers(groupedData, group.cashierIds, cashierKey);
    
    // Рассчитываем метрики
    const depositToWithdrawalPercent = group.totalWithdrawals > 0 ?
      (group.totalDeposits / group.totalWithdrawals * 100) : 0;
    
    const coveragePercent = group.totalDeposits > 0 ?
      (prepaidAmount / group.totalDeposits * 100) : 0;
    
    const avgDeposit = group.deposits.length > 0 ?
      group.deposits.reduce((a, b) => a + b, 0) / group.deposits.length : 0;
    
    const avgWithdrawal = group.withdrawals.length > 0 ?
      group.withdrawals.reduce((a, b) => a + b, 0) / group.withdrawals.length : 0;
    
    // Формируем строку экспорта
    const exportString = `${group.cashierIds[0] || ''},${round2(group.totalDeposits)},${round2(prepaidAmount)},${playerCount}`;
    
    summary.push({
      'ФГ': group.fgName,
      'Кассы': group.cashiers.join(', '),
      'Сумма пополнений ($)': round2(group.totalDeposits),
      'Сумма предоплат ($)': round2(prepaidAmount),
      'Количество игроков': playerCount,
      'Сумма выводов ($)': round2(group.totalWithdrawals),
      'Соотношение ввод/вывод (%)': round2(depositToWithdrawalPercent),
      'Покрытие предоплатами (%)': round2(coveragePercent),
      'Комиссия ($)': round2(group.totalCommission),
      'Средний депозит ($)': round2(avgDeposit),
      'Средний вывод ($)': round2(avgWithdrawal),
      'Профит ($)': round2(group.totalProfit),
      'Количество касс': group.cashiers.length,
      'Export': exportString
    });
  });
  
  console.log('[FG Summary] Создано строк:', summary.length);
  return summary;
}

function countPlayersForCashiers(data, cashierIds, cashierKey) {
  let count = 0;
  
  data.forEach(row => {
    if (row._isFG || row._isOverall || row._separator) return;
    
    const rowCashier = String(row[cashierKey] || '');
    const rowCashierId = extractCashierId(rowCashier);
    
    if (cashierIds.includes(rowCashierId)) {
      count++;
    }
  });
  
  return count;
}

function extractCashierId(cashierStr) {
  const match = String(cashierStr).match(/(\d+)[,\s]/);
  return match ? match[1] : cashierStr;
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

if (typeof self !== 'undefined' && self.importScripts) {
  self.createFGSummary = createFGSummary;
}
