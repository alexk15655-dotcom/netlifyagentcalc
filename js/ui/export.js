'use strict';

/**
 * Экспортирует данные в CSV файл
 */
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
    case 'nameCheck':
      data = results.nameCheck;
      filename = 'name_check';
      break;
    case 'fgSummary':
      data = results.fgSummary;
      filename = 'fg_summary';
      break;
    case 'fraud':
      data = results.fraudAnalysis;
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
  
  // Убираем служебные поля
  const cleanData = data.map(row => {
    const clean = {};
    Object.keys(row).forEach(key => {
      if (!key.startsWith('_')) {
        clean[key] = row[key];
      }
    });
    return clean;
  });
  
  // Конвертируем в CSV с точкой с запятой и запятой для десятичных
  const csv = Papa.unparse(cleanData, {
    delimiter: ';',
    quotes: true,
    header: true
  });
  
  // Заменяем точку на запятую в числах (европейский формат)
  const csvEuropean = csv.replace(/(\d)\.(\d)/g, '$1,$2');
  
  // Создаем blob и скачиваем
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

function getTimestamp() {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
}
