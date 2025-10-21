'use strict';

// Импорт модулей обработки
importScripts(
  '../core/processor.js',
  '../core/fraud-analyzer.js',
  '../core/fg-summary.js'
);

// Обработчик сообщений от главного потока
self.onmessage = function(e) {
  const { mainData, prepayData, config } = e.data;
  
  try {
    if (!mainData || mainData.length === 0) {
      throw new Error('Основной файл пуст');
    }
    
    console.log('[Worker] Начало обработки:', mainData.length, 'строк');
    console.log('[Worker] Config:', config);
    
    // 1. Обработка основных данных
    const processed = processData(mainData, config);
    console.log('[Worker] ✓ Данные обработаны');
    
    // 2. Группировка
    const grouped = groupData(processed, config.cashierColumn);
    console.log('[Worker] ✓ Данные сгруппированы');
    
    // 3. Анализ фрода
    const fraudAnalysis = analyzeFraud(processed, config.cashierColumn, config.fraudConfig);
    console.log('[Worker] ✓ Фрод-анализ выполнен');
    
    // 4. Сводка по ФГ (если включено)
    let fgSummary = null;
    if (config.createSummary) {
      fgSummary = createFGSummary(grouped, prepayData);
      console.log('[Worker] ✓ Сводка создана');
    }
    
    // Отправляем результаты обратно
    self.postMessage({
      processed,
      grouped,
      fraudAnalysis,
      fgSummary,
      config,
      timestamp: new Date().toISOString()
    });
    
    console.log('[Worker] ✓ Обработка завершена');
    
  } catch (error) {
    console.error('[Worker] Ошибка:', error);
    self.postMessage({ 
      error: error.message,
      stack: error.stack 
    });
  }
};
