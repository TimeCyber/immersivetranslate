// 侧边栏翻译器 - 用于全文翻译和滚动自动翻译功能
// 作者：AI快码加编 公众号

// 使用WeakSet追踪已翻译元素，防止重复翻译
const translatedElements = new WeakSet();
// 使用Set跟踪已请求翻译的文本，防止重复请求
const translatedTexts = new Set();
// 使用Map缓存翻译结果
const translationCache = new Map();
// 使用Map跟踪正在进行中的翻译请求
const pendingTranslations = new Map();
// 跟踪当前活动状态
let isTranslating = false;
let isScrollListenerActive = false;
// 跟踪处理中的段落数量
let processingCount = 0;
// 使用防抖处理滚动事件
let scrollDebounceTimer = null;
// 记录当前翻译批次的唯一标识符
let currentBatchId = 0;
// 记录已发送但未收到响应的翻译请求
const pendingRequests = new Map();
// 记录错误状态，避免同一类型错误反复显示
const errorStatus = {
  ollamaConnection: false, // 是否已显示Ollama连接错误
  errorCount: 0,  // 连续错误计数
  lastErrorTime: 0 // 上次错误时间
};
// 批处理翻译状态
const batchState = {
  isProcessing: false,  // 是否正在处理批次
  queue: [],           // 待处理元素队列
  maxConcurrent: 2     // 最大同时翻译请求数
};

// 将关键函数暴露到全局作用域，使content.js可以访问
window.createSidebarButton = createSidebarButton;
window.toggleTranslation = toggleTranslation;
window.translateVisibleContent = translateVisibleContent;

// 创建侧边栏翻译按钮
function createSidebarButton() {
  console.log('[侧边栏翻译] 创建侧边栏翻译按钮');
  
  // 检查按钮是否已存在
  if (document.querySelector('.translator-sidebar-button')) {
    console.log('[侧边栏翻译] 按钮已存在，不重复创建');
    return;
  }
  
  // 创建按钮
  const button = document.createElement('div');
  button.className = 'translator-sidebar-button';
  button.textContent = '译';
  button.title = '点击开始/停止全文翻译';
  
  // 设置按钮样式，确保可见
  button.style.position = 'fixed';
  button.style.bottom = '100px';
  button.style.right = '20px';
  button.style.width = '50px';
  button.style.height = '50px';
  button.style.backgroundColor = '#2196F3';
  button.style.color = '#ffffff';
  button.style.borderRadius = '50%';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.fontSize = '20px';
  button.style.fontWeight = 'bold';
  button.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.3)';
  button.style.cursor = 'pointer';
  button.style.zIndex = '999999';
  
  // 添加到文档
  document.body.appendChild(button);
  
  // 添加点击事件
  button.addEventListener('click', toggleTranslation);
  
  console.log('[侧边栏翻译] 按钮创建成功');
  
  // 记录按钮是否成功添加到文档
  setTimeout(() => {
    const buttonExists = document.querySelector('.translator-sidebar-button');
    if (buttonExists) {
      console.log('[侧边栏翻译] 按钮已成功添加到文档并可见');
    } else {
      console.error('[侧边栏翻译] 按钮创建失败或不可见');
    }
  }, 500);
}

// 切换翻译状态
function toggleTranslation() {
  console.log('[侧边栏翻译] 切换翻译状态：', { 当前状态: isTranslating ? '活跃' : '非活跃' });
  
  // 获取按钮元素
  const button = document.querySelector('.translator-sidebar-button');
  if (!button) {
    console.error('[侧边栏翻译] 找不到翻译按钮');
    return;
  }
  
  if (isTranslating) {
    // 停止翻译模式
    isTranslating = false;
    isScrollListenerActive = false;
    button.classList.remove('active');
    button.textContent = '译';
    button.title = '点击开始全文翻译';
    
    // 添加停止动画效果
    button.classList.add('stop-animation');
    setTimeout(() => button.classList.remove('stop-animation'), 500);
    
    // 移除滚动监听
    window.removeEventListener('scroll', handleScroll);
    // 清除所有加载指示器
    removeAllLoadingIndicators();
    console.log('[侧边栏翻译] 翻译已停止');
  } else {
    // 开始翻译模式
    isTranslating = true;
    button.classList.add('active');
    button.textContent = '停';
    button.title = '点击停止全文翻译';
    
    // 添加启动动画效果
    button.classList.add('start-animation');
    setTimeout(() => button.classList.remove('start-animation'), 500);
    
    // 立即翻译可见内容
    translateVisibleContent();
    
    // 添加滚动监听
    if (!isScrollListenerActive) {
      window.addEventListener('scroll', handleScroll);
      isScrollListenerActive = true;
      console.log('[侧边栏翻译] 已添加滚动监听');
    }
    
    console.log('[侧边栏翻译] 翻译已开始');
  }
}

// 处理滚动事件（使用防抖优化）
function handleScroll() {
  // 防抖处理，避免频繁触发
  clearTimeout(scrollDebounceTimer);
  scrollDebounceTimer = setTimeout(() => {
    if (isTranslating) {
      console.log('[侧边栏翻译] 检测到滚动，翻译可见内容');
      translateVisibleContent();
    }
  }, 300); // 300ms防抖时间
}

// 翻译可见内容
function translateVisibleContent() {
  // 检查是否处于活跃翻译状态
  if (!isTranslating) {
    console.log('[侧边栏翻译] 当前不在翻译状态，跳过翻译');
    return;
  }
  
  // 生成新的批次ID
  currentBatchId = Date.now();
  console.log(`[侧边栏翻译] 开始新批次翻译 #${currentBatchId}`);
  
  // 获取可见的文本元素
  const textElements = getVisibleTextElements();
  
  if (textElements.length === 0) {
    console.log('[侧边栏翻译] 没有找到可见的需要翻译的文本元素');
    return;
  }
  
  console.log(`[侧边栏翻译] 找到 ${textElements.length} 个可见文本元素`);
  
  // 如果当前有错误状态，先重置错误状态尝试重新翻译
  if (errorStatus.ollamaConnection && Date.now() - errorStatus.lastErrorTime > 5000) {
    console.log('[侧边栏翻译] 重置错误状态，允许新的翻译请求');
    errorStatus.ollamaConnection = false;
    errorStatus.errorCount = 0;
  }
  
  // 如果有错误状态且持续时间短，则跳过本次翻译
  if (errorStatus.ollamaConnection) {
    console.log('[侧边栏翻译] Ollama连接错误状态未恢复，跳过本次翻译');
    return;
  }
  
  // 显示处理中的徽章
  showProcessingBadge(`0/${textElements.length}`);
  
  // 重置批处理状态
  batchState.queue = [...textElements];
  
  // 如果当前没有正在处理的批次，开始处理
  if (!batchState.isProcessing) {
    startBatchProcessing();
  } else {
    console.log('[侧边栏翻译] 已有批次正在处理，将新元素加入队列');
  }
}

// 开始批处理
function startBatchProcessing() {
  if (batchState.isProcessing || batchState.queue.length === 0) {
    return;
  }
  
  batchState.isProcessing = true;
  console.log(`[侧边栏翻译] 开始批处理，队列中有 ${batchState.queue.length} 个元素`);
  
  // 更新进度显示
  updateProcessingBadge(`${Math.max(0, batchState.queue.length - pendingRequests.size)}/${batchState.queue.length}`);
  
  // 处理队列中的元素，但限制同时处理的数量
  processNextBatch();
}

// 处理下一批元素
function processNextBatch() {
  // 如果翻译已停止或队列为空，结束处理
  if (!isTranslating || batchState.queue.length === 0) {
    console.log('[侧边栏翻译] 批处理完成或翻译已停止');
    batchState.isProcessing = false;
    
    if (processingCount === 0) {
      hideProcessingBadge();
    }
    
    return;
  }
  
  // 如果有连接错误，暂停处理
  if (errorStatus.ollamaConnection) {
    console.log('[侧边栏翻译] 检测到Ollama连接错误，暂停批处理');
    batchState.isProcessing = false;
    return;
  }
  
  // 计算可以同时处理的请求数量
  const available = Math.max(0, batchState.maxConcurrent - pendingRequests.size);
  
  if (available <= 0) {
    console.log('[侧边栏翻译] 已达到最大并发请求数，等待进行中的请求完成');
    return;
  }
  
  // 处理可并发的请求数量
  const elementsToProcess = batchState.queue.splice(0, available);
  
  console.log(`[侧边栏翻译] 处理新的 ${elementsToProcess.length} 个元素，队列剩余 ${batchState.queue.length} 个`);
  
  // 更新进度显示
  updateProcessingBadge(`${batchState.queue.length}/${batchState.queue.length + pendingRequests.size + elementsToProcess.length}`);
  
  // 翻译元素
  elementsToProcess.forEach(element => {
    translateElement(element, currentBatchId, () => {
      // 翻译完成后处理下一批
      setTimeout(() => {
        processNextBatch();
      }, 100);
    });
  });
}

// 获取可见的文本元素
function getVisibleTextElements() {
  console.log('[侧边栏翻译] 获取可见文本元素');
  
  // 适合翻译的选择器
  const selectors = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'div.text', 'div.content',
    'article', 'section', 'main > div', '.article-content',
    '.post-content', '.entry-content'
  ];
  
  // 查找所有匹配选择器的元素
  const potentialElements = document.querySelectorAll(selectors.join(','));
  
  // 过滤可见且包含内容并且未翻译的元素
  const visibleElements = Array.from(potentialElements).filter(element => {
    // 跳过已翻译的元素
    if (translatedElements.has(element)) {
      return false;
    }
    
    // 跳过隐藏元素
    if (!isElementVisible(element)) {
      return false;
    }
    
    // 确保元素有可翻译内容
    return hasTranslatableContent(element);
  });
  
  console.log(`[侧边栏翻译] 找到 ${visibleElements.length} 个可翻译的可见元素`);
  return visibleElements;
}

// 检查元素是否可见
function isElementVisible(element) {
  // 检查元素和其祖先是否可见
  if (!element || !element.getBoundingClientRect) {
    return false;
  }
  
  const rect = element.getBoundingClientRect();
  
  // 元素必须在视口内或附近
  const isInViewport = (
    rect.top < (window.innerHeight + 500) && // 包括视口下方500px
    rect.bottom > -500 && // 包括视口上方500px
    rect.left < (window.innerWidth + 200) && // 包括视口右侧200px
    rect.right > -200 // 包括视口左侧200px
  );
  
  if (!isInViewport) {
    return false;
  }
  
  // 检查元素是否被隐藏
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  
  return true;
}

// 检查元素是否包含可翻译内容
function hasTranslatableContent(element) {
  // 获取元素的文本内容
  const text = element.innerText || element.textContent;
  
  // 跳过空内容或极短内容
  if (!text || text.trim().length < 10) {
    return false;
  }
  
  // 检查元素内是否有译文框，避免翻译已有译文框的元素
  if (element.querySelector('.translator-paragraph-translation')) {
    return false;
  }
  
  // 检查元素本身是否是译文框
  if (element.classList.contains('translator-paragraph-translation')) {
    return false;
  }
  
  // 检查元素是否包含足够的文本内容
  // 计算中文字符和英文字符的比例
  let chineseChars = 0;
  let englishChars = 0;
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // 中文字符范围
    if (charCode >= 0x4e00 && charCode <= 0x9fff) {
      chineseChars++;
    }
    // 英文字母范围
    else if ((charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122)) {
      englishChars++;
    }
  }
  
  // 计算中英文比例
  const totalChars = text.length;
  const chineseRatio = chineseChars / totalChars;
  const englishRatio = englishChars / totalChars;
  
  // 判断需要翻译的情况:
  // 1. 中文占比高于50%时，认为是中文内容，不需要翻译
  if (chineseRatio > 0.5) {
    return false;
  }
  
  // 2. 英文字符占比超过25%时，认为需要翻译
  if (englishRatio > 0.25) {
    return true;
  }
  
  // 3. 混合语言判断规则
  // 3.1 英文占比高但中文少，需要翻译
  if (englishRatio > 0.3 && chineseRatio < 0.2) {
    return true;
  }
  
  // 3.2 中英文都存在一定比例，需要翻译
  if (englishRatio > 0.2 && chineseRatio > 0.1 && chineseRatio < 0.4) {
    return true;
  }
  
  // 4. 如果中文字符超过15个，认为是纯中文内容，不需要翻译
  if (chineseChars > 15) {
    return false;
  }
  
  // 默认情况下，假设需要翻译
  return true;
}

// 翻译单个元素
function translateElement(element, batchId, callback) {
  // 防止重复翻译
  if (translatedElements.has(element)) {
    console.log('[侧边栏翻译] 跳过已翻译元素');
    if (callback) callback();
    return;
  }
  
  // 获取元素文本
  const text = element.innerText || element.textContent;
  
  // 检查文本是否有效
  if (!text || text.trim().length < 10) {
    console.log('[侧边栏翻译] 跳过内容过短元素');
    translatedElements.add(element);
    if (callback) callback();
    return;
  }
  
  // 检查是否已经请求过相同文本的翻译
  if (translatedTexts.has(text)) {
    console.log('[侧边栏翻译] 跳过已请求翻译的文本');
    translatedElements.add(element);
    if (callback) callback();
    return;
  }
  
  // 检查缓存中是否有该文本的翻译
  if (translationCache.has(text)) {
    console.log('[侧边栏翻译] 使用缓存的翻译结果');
    const translation = translationCache.get(text);
    displayTranslation(element, translation);
    translatedElements.add(element);
    if (callback) callback();
    return;
  }
  
  // 检查是否有正在进行中的相同翻译请求
  if (pendingTranslations.has(text)) {
    console.log('[侧边栏翻译] 该文本已有正在进行的翻译请求，等待结果');
    // 将当前元素添加到等待相同翻译结果的元素列表中
    const pendingInfo = pendingTranslations.get(text);
    pendingInfo.elements.push({
      element,
      batchId
    });
    
    // 为当前元素添加加载指示器
    const loadingIndicator = addLoadingIndicator(element);
    pendingInfo.loadingIndicators.push(loadingIndicator);
    
    // 添加回调到等待列表
    if (callback) {
      if (!pendingInfo.callbacks) {
        pendingInfo.callbacks = [];
      }
      pendingInfo.callbacks.push(callback);
    }
    
    return;
  }
  
  // 检查是否有连接错误正在显示，如果有则跳过
  if (errorStatus.ollamaConnection) {
    console.log('[侧边栏翻译] 检测到Ollama连接错误状态，跳过新的翻译请求');
    translatedElements.add(element);
    if (callback) callback();
    return;
  }
  
  // 记录该文本已请求翻译
  translatedTexts.add(text);
  
  // 添加加载指示器
  const loadingIndicator = addLoadingIndicator(element);
  
  // 增加处理计数
  processingCount++;
  console.log(`[侧边栏翻译] 开始翻译元素，当前处理中数量: ${processingCount}`);
  
  // 生成唯一的消息ID用于跟踪请求
  const messageId = `translate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 记录等待响应的请求
  pendingRequests.set(messageId, {
    element,
    loadingIndicator,
    batchId,
    timestamp: Date.now()
  });
  
  // 在pendingTranslations中记录正在进行的翻译
  pendingTranslations.set(text, {
    messageId,
    elements: [{ element, batchId }],
    loadingIndicators: [loadingIndicator],
    callbacks: callback ? [callback] : [],
    timestamp: Date.now()
  });
  
  // 发送翻译请求
  translate(text, messageId)
    .then(translation => {
      // 检查该批次是否已取消
      if (batchId !== currentBatchId) {
        console.log(`[侧边栏翻译] 批次已过期 #${batchId}，当前批次 #${currentBatchId}`);
        return;
      }
      
      // 移除等待响应的记录
      pendingRequests.delete(messageId);
      
      // 获取等待该翻译的所有元素
      const pendingInfo = pendingTranslations.get(text);
      if (pendingInfo) {
        // 为所有等待该翻译的元素显示结果
        pendingInfo.elements.forEach(item => {
          // 确保批次ID匹配当前批次
          if (item.batchId === currentBatchId) {
            displayTranslation(item.element, translation);
            translatedElements.add(item.element);
          }
        });
        
        // 移除所有相关的加载指示器
        pendingInfo.loadingIndicators.forEach(indicator => {
          if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        });
        
        // 执行所有回调
        if (pendingInfo.callbacks && pendingInfo.callbacks.length > 0) {
          pendingInfo.callbacks.forEach(cb => {
            if (typeof cb === 'function') cb();
          });
        }
        
        // 从等待列表中移除
        pendingTranslations.delete(text);
      } else {
        // 显示翻译结果
        displayTranslation(element, translation);
        // 标记元素已翻译
        translatedElements.add(element);
        
        // 执行回调
        if (callback) callback();
      }
      
      // 缓存翻译结果
      translationCache.set(text, translation);
      
      // 重置错误状态
      errorStatus.ollamaConnection = false;
      errorStatus.errorCount = 0;
    })
    .catch(error => {
      console.error('[侧边栏翻译] 翻译出错:', error);
      
      // 移除等待响应的记录
      pendingRequests.delete(messageId);
      
      // 增加错误计数并记录时间
      errorStatus.errorCount++;
      errorStatus.lastErrorTime = Date.now();
      
      // 检查错误类型
      if (error.message && error.message.includes('无法连接到Ollama服务')) {
        // 更新错误状态标志
        console.log('[侧边栏翻译] 检测到Ollama连接错误，设置错误状态标志');
        errorStatus.ollamaConnection = true;
        
        // 如果是首次遇到这种错误或超过10秒没有显示过，才显示错误
        if (errorStatus.errorCount <= 1 || Date.now() - errorStatus.lastErrorTime > 10000) {
          // 获取等待该翻译的所有元素
          const pendingInfo = pendingTranslations.get(text);
          if (pendingInfo) {
            // 为第一个元素显示错误消息，其余元素只标记为已翻译
            const errorMessage = `翻译失败: ${error.message || '未知错误'}`;
            let firstElement = true;
            
            pendingInfo.elements.forEach(item => {
              if (firstElement) {
                displayTranslation(item.element, errorMessage, true);
                firstElement = false;
              }
              translatedElements.add(item.element);
            });
            
            // 移除所有相关的加载指示器
            pendingInfo.loadingIndicators.forEach(indicator => {
              if (indicator && indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
              }
            });
            
            // 执行所有回调
            if (pendingInfo.callbacks && pendingInfo.callbacks.length > 0) {
              pendingInfo.callbacks.forEach(cb => {
                if (typeof cb === 'function') cb();
              });
            }
          } else {
            // 显示错误消息而不是空白
            const errorMessage = `翻译失败: ${error.message || '未知错误'}`;
            displayTranslation(element, errorMessage, true);
            
            // 执行回调
            if (callback) callback();
          }
        } else {
          console.log('[侧边栏翻译] 跳过显示重复的Ollama连接错误');
          
          // 清理所有加载指示器
          const pendingInfo = pendingTranslations.get(text);
          if (pendingInfo) {
            pendingInfo.loadingIndicators.forEach(indicator => {
              if (indicator && indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
              }
            });
            
            // 标记所有元素为已翻译，但不显示错误消息
            pendingInfo.elements.forEach(item => {
              translatedElements.add(item.element);
            });
            
            // 执行所有回调
            if (pendingInfo.callbacks && pendingInfo.callbacks.length > 0) {
              pendingInfo.callbacks.forEach(cb => {
                if (typeof cb === 'function') cb();
              });
            }
          } else {
            // 标记当前元素为已翻译，但不显示错误消息
            translatedElements.add(element);
            
            // 移除加载指示器
            if (loadingIndicator && loadingIndicator.parentNode) {
              loadingIndicator.parentNode.removeChild(indicator);
            }
            
            // 执行回调
            if (callback) callback();
          }
        }
      } else {
        // 其他类型错误正常显示
        const errorMessage = `翻译失败: ${error.message || '未知错误'}`;
        
        // 获取等待该翻译的所有元素
        const pendingInfo = pendingTranslations.get(text);
        if (pendingInfo) {
          // 为所有等待该翻译的元素显示错误消息
          pendingInfo.elements.forEach(item => {
            displayTranslation(item.element, errorMessage, true);
            translatedElements.add(item.element);
          });
          
          // 移除所有相关的加载指示器
          pendingInfo.loadingIndicators.forEach(indicator => {
            if (indicator && indicator.parentNode) {
              indicator.parentNode.removeChild(indicator);
            }
          });
          
          // 执行所有回调
          if (pendingInfo.callbacks && pendingInfo.callbacks.length > 0) {
            pendingInfo.callbacks.forEach(cb => {
              if (typeof cb === 'function') cb();
            });
          }
        } else {
          // 显示错误消息而不是空白
          displayTranslation(element, errorMessage, true);
          translatedElements.add(element);
          
          // 执行回调
          if (callback) callback();
        }
      }
      
      // 从等待列表中移除
      pendingTranslations.delete(text);
    })
    .finally(() => {
      // 不需要在这里移除加载指示器，已经在上面处理了
      
      // 减少处理计数
      processingCount--;
      console.log(`[侧边栏翻译] 元素翻译完成，当前处理中数量: ${processingCount}`);
      
      // 如果没有正在处理的元素，隐藏进度徽章
      if (processingCount === 0) {
        hideProcessingBadge();
      }
    });
}

// 翻译函数 - 处理文本翻译请求
async function translate(text, messageId) {
  if (!text || text.trim() === '') {
    return '';
  }
  
  console.log('[侧边栏翻译] 发送翻译请求:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  
  // 如果当前处于Ollama连接错误状态且错误次数超过阈值，直接拒绝新的请求
  if (errorStatus.ollamaConnection && errorStatus.errorCount > 3) {
    console.log('[侧边栏翻译] 由于连续Ollama连接错误，拒绝新的翻译请求');
    return Promise.reject(new Error('翻译服务暂时不可用，请稍后再试'));
  }
  
  // 使用消息通信直接请求后台进行翻译
  return new Promise((resolve, reject) => {
    // 设置30秒超时
    const timeoutId = setTimeout(() => {
      console.log('[侧边栏翻译] 翻译请求超时');
      reject(new Error('翻译请求超时，请稍后再试'));
    }, 30000);
    
    // 发送消息到后台脚本
    chrome.runtime.sendMessage({
      action: 'translate',
      text: text,
      messageId: messageId
    }, response => {
      // 清除超时
      clearTimeout(timeoutId);
      
      // 处理通信错误
      if (chrome.runtime.lastError) {
        console.error('[侧边栏翻译] 发送翻译请求时出错:', chrome.runtime.lastError);
        reject(new Error('与翻译服务通信失败: ' + chrome.runtime.lastError.message));
        return;
      }
      
      // 处理响应
      if (response && response.success) {
        console.log('[侧边栏翻译] 收到翻译结果:', response.translation.substring(0, 50) + (response.translation.length > 50 ? '...' : ''));
        resolve(response.translation);
      } else {
        const errorMessage = (response && response.error) ? response.error : '未知错误';
        console.error('[侧边栏翻译] 翻译响应错误:', errorMessage);
        reject(new Error(errorMessage));
      }
    });
  });
}

// 显示翻译结果
function displayTranslation(element, translation, isError = false) {
  // 创建翻译显示容器
  const translationElement = document.createElement('div');
  translationElement.className = 'translator-paragraph-translation';
  
  if (isError) {
    translationElement.classList.add('translator-error');
  }
  
  // 设置翻译内容
  translationElement.textContent = translation;
  
  // 插入到原始元素后面
  if (element.nextSibling) {
    element.parentNode.insertBefore(translationElement, element.nextSibling);
  } else {
    element.parentNode.appendChild(translationElement);
  }
  
  // 为翻译元素添加点击事件，点击时移除
  translationElement.addEventListener('click', function(event) {
    // 如果是双击，移除翻译元素
    if (event.detail === 2) {
      if (translationElement.parentNode) {
        translationElement.parentNode.removeChild(translationElement);
      }
    }
  });
}

// 添加加载指示器
function addLoadingIndicator(element) {
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'translator-loading';
  loadingIndicator.innerHTML = '<div class="translator-loading-spinner"></div>';
  
  // 插入到原始元素后面
  if (element.nextSibling) {
    element.parentNode.insertBefore(loadingIndicator, element.nextSibling);
  } else {
    element.parentNode.appendChild(loadingIndicator);
  }
  
  return loadingIndicator;
}

// 移除所有加载指示器
function removeAllLoadingIndicators() {
  const indicators = document.querySelectorAll('.translator-loading');
  indicators.forEach(indicator => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  });
  
  // 清除所有待处理的请求
  pendingRequests.clear();
  
  // 清除所有正在进行的翻译
  pendingTranslations.clear();
  
  // 重置处理计数
  processingCount = 0;
  
  // 重置错误状态
  errorStatus.ollamaConnection = false;
  errorStatus.errorCount = 0;
  
  // 重置批处理状态
  batchState.isProcessing = false;
  batchState.queue = [];
  
  // 隐藏进度徽章
  hideProcessingBadge();
  
  // 移除所有翻译结果
  const translations = document.querySelectorAll('.translator-paragraph-translation');
  translations.forEach(translation => {
    if (translation.parentNode) {
      translation.parentNode.removeChild(translation);
    }
  });
}

// 显示处理中徽章
function showProcessingBadge(text) {
  let badge = document.querySelector('.translator-processing-badge');
  
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'translator-processing-badge';
    document.body.appendChild(badge);
  }
  
  badge.innerHTML = `<span class="translator-processing-icon"></span><span class="translator-processing-text">${text}</span>`;
  badge.style.display = 'flex';
}

// 更新处理中徽章
function updateProcessingBadge(text) {
  const badge = document.querySelector('.translator-processing-badge');
  if (badge) {
    const textElement = badge.querySelector('.translator-processing-text');
    if (textElement) {
      textElement.textContent = text;
    }
  }
}

// 隐藏处理中徽章
function hideProcessingBadge() {
  const badge = document.querySelector('.translator-processing-badge');
  if (badge) {
    badge.style.display = 'none';
  }
}

// 检查后台服务是否正常
function checkBackgroundService() {
  console.log('[侧边栏翻译] 检查后台服务');
  
  chrome.runtime.sendMessage({ action: 'ping' }, response => {
    if (chrome.runtime.lastError) {
      console.error('[侧边栏翻译] 后台服务检查失败:', chrome.runtime.lastError);
      return;
    }
    
    if (response && response.success) {
      console.log('[侧边栏翻译] 后台服务正常运行');
    } else {
      console.error('[侧边栏翻译] 后台服务响应异常:', response);
    }
  });
}

// 页面加载完成后初始化
function initSidebarTranslator() {
  console.log('[侧边栏翻译] 初始化开始');
  
  // 确保页面完全加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady);
  } else {
    onDomReady();
  }
  
  function onDomReady() {
    console.log('[侧边栏翻译] DOM已加载，创建侧边栏按钮');
    
    // 创建侧边栏按钮
    createSidebarButton();
    
    // 检查后台服务
    checkBackgroundService();
    
    // 确保按钮创建，即使DOM加载延迟也能创建
    setTimeout(() => {
      if (!document.querySelector('.translator-sidebar-button')) {
        console.log('[侧边栏翻译] 延迟检测未找到按钮，尝试重新创建');
        createSidebarButton();
      }
    }, 1000);
    
    console.log('[侧边栏翻译] 初始化完成');
  }
}

// 确保即使在DOM已经加载完成后脚本才执行，也能正确初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('[侧边栏翻译] 页面已加载，直接初始化');
  setTimeout(initSidebarTranslator, 500);
} else {
  // 正常初始化流程
  initSidebarTranslator();
} 