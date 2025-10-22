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
    
    // 1. Обработка основных данных + построение маппинга
    const { processed, cashierToAgent } = processData(mainData, config);
    console.log('[Worker] ✓ Данные обработаны');
    console.log('[Worker] ✓ Маппинг построен:', Object.keys(cashierToAgent).length, 'записей');
    
    // 2. Группировка
    const grouped = groupData(processed, config.cashierColumn);
    console.log('[Worker] ✓ Данные сгруппированы');
    
    // 3. Анализ фрода (с готовым маппингом)
    const fraudAnalysis = analyzeFraud(
      processed, 
      config.cashierColumn, 
      config.fraudConfig,
      cashierToAgent  // ← передаем готовый маппинг
    );
    console.log('[Worker] ✓ Фрод-анализ выполнен');
    
    // 4. Сводка по ФГ (с готовым маппингом, если включено)
    let fgSummary = null;
    if (config.createSummary) {
      fgSummary = createFGSummary(
        grouped, 
        prepayData,
        cashierToAgent  // ← передаем готовый маппинг
      );
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
