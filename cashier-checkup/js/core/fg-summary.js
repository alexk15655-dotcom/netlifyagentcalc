'use strict';

/**
 * Создает сводку по финансовым группам
 * Портировано из createFGSummary() в .gs файле
 */
function createFGSummary(groupedData, prepayData) {
  console.log('[FG Summary] Создание сводки');
  
  if (!groupedData || groupedData.length === 0) {
    return null;
  }
  
  // Находим строки ФГ
  const fgRows = groupedData.filter(row => row._isFG);
  
  if (fgRows.length === 0) {
    console.warn('[FG Summary] Строки ФГ не найдены');
    return null;
  }
  
  const headers = Object.keys(fgRows[0]);
  const cashierKey = fgRows[0]._cashierColumn;
  
  // Строим сводку для каждой ФГ
  const summary = [];
  
  fgRows.forEach(fgRow => {
    // Извлекаем имя ФГ
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
    
    // Извлекаем ID кассы
    const cashierId = extractCashierId(cashierInfo);
    
    // Получаем данные из строки ФГ
    const parseNum = (val) => parseFloat(String(val).replace(/[\s,]/g, '')) || 0;
    
    const totalDeposits = parseNum(
      fgRow['Сумма пополнений (в валюте админа по курсу текущего дня)'] ||
      fgRow['Сумма пополнений (в валюте админа)'] || 0
    );
    
    const totalWithdrawals = parseNum(
      fgRow['Сумма вывода (в валюте админа по курсу текущего дня)'] ||
      fgRow['Сумма вывода (в валюте админа)'] || 0
    );
    
    const depCount = parseNum(fgRow['Количество пополнений'] || 0);
    const withCount = parseNum(fgRow['Количество выводов'] || 0);
    const commission = parseNum(fgRow['Комиссия'] || 0);
    const profit = parseNum(fgRow['Профит'] || 0);
    
    // Ищем prepayment для этой ФГ
    let prepaidAmount = 0;
    if (prepayData && prepayData.length > 0) {
      const prepayRow = prepayData.find(p => {
        const prepayFG = String(p['Фин. группа'] || p['Финансовая группа'] || '').trim();
        return prepayFG.includes(fgName) || fgName.includes(prepayFG);
      });
      
      if (prepayRow) {
        prepaidAmount = parseNum(
          prepayRow['Сумма пополнений (в валюте админа)'] ||
          prepayRow['Сумма пополнений'] || 0
        );
      }
    }
    
    // Считаем количество игроков
    const playerCount = countPlayersForCashier(groupedData, cashierInfo, cashierKey);
    
    // Рассчитываем метрики
    const depositToWithdrawalPercent = totalWithdrawals > 0 ?
      (totalDeposits / totalWithdrawals * 100) : 0;
    
    const coveragePercent = totalDeposits > 0 ?
      (prepaidAmount / totalDeposits * 100) : 0;
    
    const avgDeposit = depCount > 0 ? totalDeposits / depCount : 0;
    const avgWithdrawal = withCount > 0 ? totalWithdrawals / withCount : 0;
    
    // Формируем строку экспорта
    const exportString = `${cashierId},${round2(totalDeposits)},${round2(prepaidAmount)},${playerCount}`;
    
    summary.push({
      'ФГ': fgName,
      'Кассы': cashierInfo,
      'Сумма пополнений ($)': round2(totalDeposits),
      'Сумма предоплат ($)': round2(prepaidAmount),
      'Количество игроков': playerCount,
      'Сумма выводов ($)': round2(totalWithdrawals),
      'Соотношение ввод/вывод (%)': round2(depositToWithdrawalPercent),
      'Покрытие предоплатами (%)': round2(coveragePercent),
      'Комиссия ($)': round2(commission),
      'Средний депозит ($)': round2(avgDeposit),
      'Средний вывод ($)': round2(avgWithdrawal),
      'Профит ($)': round2(profit),
      'Количество касс': 1,
      'Export': exportString
    });
  });
  
  console.log('[FG Summary] Создано строк:', summary.length);
  return summary;
}

function countPlayersForCashier(data, cashierInfo, cashierKey) {
  const cashierId = extractCashierId(cashierInfo);
  
  let count = 0;
  data.forEach(row => {
    if (row._isFG || row._isOverall || row._separator) return;
    
    const rowCashier = String(row[cashierKey] || '');
    const rowCashierId = extractCashierId(rowCashier);
    
    if (rowCashierId === cashierId) {
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

// Экспорт для Web Worker
if (typeof self !== 'undefined' && self.importScripts) {
  self.createFGSummary = createFGSummary;
}
