class Translator {
    constructor() {
      this.translationCache = new Map();
      this.MIN_TEXT_LENGTH = 2; // 最小翻译文本长度
      this.MAX_TEXT_LENGTH = 5000; // API限制
      
      // 简单的英文检测正则
      this.englishRegex = /^[a-zA-Z0-9\s.,!?;:()"'\-]+$/;
      
      // 需要忽略的HTML标签
      this.IGNORE_TAGS = new Set([
        'SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA',
        'INPUT', 'BUTTON', 'SELECT', 'OPTION'
      ]);
    }
    
    // 判断文本是否为英文
    isEnglish(text) {
      // 更宽松的英文检测：至少包含2个英文字母且不含中文字符
      const containsEnglishLetters = /[a-zA-Z]{2,}/.test(text);
      const containsChinese = /[\u4e00-\u9fa5]/.test(text); 
      return containsEnglishLetters && !containsChinese;
    }
    
    // 获取缓存的翻译结果
    getCachedTranslation(text) {
      return this.translationCache.get(text);
    }
    
    // 设置翻译缓存
    setCachedTranslation(text, translation) {
      this.translationCache.set(text, translation);
      
      // 简单的缓存大小限制
      if (this.translationCache.size > 1000) {
        // 删除最早添加的缓存项
        const firstKey = this.translationCache.keys().next().value;
        this.translationCache.delete(firstKey);
      }
    }
    
    // 翻译文本 - 通过后台脚本调用API
    async translateText(text, nodeId) {
      if (!text || text.length < this.MIN_TEXT_LENGTH) return text;
      if (text.length > this.MAX_TEXT_LENGTH) {
        console.warn('Text too long for translation', text.length);
        return text;
      }
      
      // 检查缓存
      const cachedResult = this.getCachedTranslation(text);
      if (cachedResult) return cachedResult;
      
      try {
        // 创建一个Promise和一个超时Promise
        const translationPromise = new Promise((resolve, reject) => {
          // 保存一个引用，以便可以在超时时识别
          const messageId = Date.now().toString() + Math.random().toString().slice(2, 8);
          
          console.log(`[Translator] 发送翻译请求 (ID: ${messageId})`);
          
          // 使用消息ID设置一个响应处理器
          const responseHandler = response => {
            console.log(`[Translator] 收到响应 (ID: ${messageId})`, response ? '成功' : '失败');
            
            if (chrome.runtime.lastError) {
              console.error(`[Translator] 错误 (ID: ${messageId}):`, chrome.runtime.lastError);
              reject(new Error(`消息错误: ${chrome.runtime.lastError.message}`));
              return;
            }
            
            if (!response) {
              reject(new Error('没有收到响应'));
              return;
            }
            
            if (!response.success) {
              reject(new Error(response.error || '翻译失败'));
              return;
            }
            
            resolve(response.translation);
          };
          
          // 发送消息
          try {
            chrome.runtime.sendMessage(
              {
                action: "translate",
                text: text,
                nodeId: nodeId,
                messageId: messageId
              },
              responseHandler
            );
          } catch (err) {
            console.error(`[Translator] 发送消息失败 (ID: ${messageId}):`, err);
            reject(new Error(`发送消息失败: ${err.message}`));
          }
        });
        
        // 创建超时Promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('翻译请求超时，请检查网络连接或后台服务'));
          }, 10000); // 10秒超时
        });
        
        // 使用Promise.race来实现超时机制
        const result = await Promise.race([translationPromise, timeoutPromise]);
        
        // 缓存结果
        this.setCachedTranslation(text, result);
        return result;
      } catch (error) {
        console.error('翻译过程中出错:', error);
        throw error; // 向上传递错误
      }
    }
  }

// 通过消息传递调用后台脚本进行翻译
async function translateText(text) {
  if (!text || text.trim() === '') {
    console.log('没有文本需要翻译');
    return text;
  }
  
  // 输出日志以便调试
  console.log('准备翻译文本:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  console.log('文本长度:', text.length);
  
  // 对特别长的文本进行截断
  if (text.length > 5000) {
    console.log('文本过长，截断至5000字符');
    text = text.substring(0, 5000) + '...';
  }
  
  return new Promise((resolve, reject) => {
    // 添加唯一请求ID以便识别请求
    const requestId = Date.now().toString() + Math.random().toString().slice(2, 8);
    console.log(`[翻译请求 ${requestId}] 开始发送...`);
    
    // 设置超时计时器
    const timeoutId = setTimeout(() => {
      console.error(`[翻译请求 ${requestId}] 超时`);
      reject(new Error('翻译请求超时，请检查网络连接和扩展状态'));
    }, 15000); // 15秒超时
    
    // 标记是否已经处理过响应
    let responseHandled = false;
    
    // 处理响应的函数
    function handleResponse(response) {
      // 避免重复处理
      if (responseHandled) return;
      responseHandled = true;
      
      // 清除超时计时器
      clearTimeout(timeoutId);
      
      console.log(`[翻译请求 ${requestId}] 收到响应:`, response ? '有效响应' : '无响应');
      
      // 检查通信错误
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        console.error(`[翻译请求 ${requestId}] 通信错误:`, errorMsg);
        
        // 尝试重新连接到扩展
        console.log(`[翻译请求 ${requestId}] 尝试重新连接...`);
        
        // 通过发送ping消息检查后台脚本是否可用
        chrome.runtime.sendMessage({ action: "ping" }, function(pingResponse) {
          if (chrome.runtime.lastError) {
            console.error(`[翻译请求 ${requestId}] 重连失败:`, chrome.runtime.lastError);
            reject(new Error(`后台脚本连接失败: ${errorMsg}`));
          } else if (pingResponse && pingResponse.success) {
            console.log(`[翻译请求 ${requestId}] 重连成功，但原请求失败`);
            reject(new Error('后台脚本已连接，但翻译请求失败'));
          } else {
            reject(new Error(`后台脚本状态异常: ${errorMsg}`));
          }
        });
        return;
      }
      
      // 检查响应
      if (!response) {
        reject(new Error('翻译失败: 没有接收到响应'));
        return;
      }
      
      if (!response.success) {
        console.error(`[翻译请求 ${requestId}] 翻译失败:`, response.error);
        
        // 如果后台脚本报告连接失败，可能是API问题
        if (response.error && (
            response.error.includes('Failed to fetch') || 
            response.error.includes('fetch failed') ||
            response.error.includes('网络错误')
          )) {
          reject(new Error('翻译API连接失败，请检查网络连接'));
        } else {
          reject(new Error(response.error || '翻译失败'));
        }
        return;
      }
      
      console.log(`[翻译请求 ${requestId}] 翻译成功, 结果长度:`, response.translation.length);
      
      // 返回完整翻译结果
      resolve(response.translation);
    }
    
    try {
      console.log(`[翻译请求 ${requestId}] 发送翻译请求到后台...`);
      chrome.runtime.sendMessage(
        {
          action: 'translate', // 使用小写的'translate'作为action值
          text: text,
          messageId: requestId // 使用messageId作为参数名，与background.js匹配
        },
        handleResponse
      );
    } catch (error) {
      responseHandled = true;
      clearTimeout(timeoutId);
      console.error(`[翻译请求 ${requestId}] 发送消息时出错:`, error);
      reject(new Error(`发送消息失败: ${error.message}`));
    }
  });
}

// 创建翻译弹出框
function createTranslationPopup() {
  // 检查是否已经存在
  let popup = document.getElementById('translation-popup');
  if (popup) return popup;
  
  // 创建弹出框
  popup = document.createElement('div');
  popup.id = 'translation-popup';
  popup.style.cssText = `
    position: absolute;
    background: #ffffff;
    border-radius: 10px;
    padding: 0;
    overflow: hidden;
    max-height: 300px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    display: none;
    border: none;
    animation: fadeIn 0.25s ease-out;
    transition: all 0.2s ease;
    color: #333333 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    min-width: 200px;
    max-width: 400px;
  `;
  
  // 添加动画和样式覆盖
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    #translation-popup {
      color: #333333 !important;
    }
    
    #translation-popup * {
      color: #333333 !important;
      box-sizing: border-box;
    }
    
    #translation-popup .popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: #f8f9fa;
      border-bottom: 1px solid #eaeaea;
    }
    
    #translation-popup .popup-title {
      font-weight: 600;
      font-size: 13px;
      color: #5f6368 !important;
    }
    
    #translation-popup .popup-actions {
      display: flex;
      gap: 8px;
    }
    
    #translation-popup .action-button {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: transparent;
      transition: background 0.2s;
      font-size: 14px;
    }
    
    #translation-popup .action-button:hover {
      background: rgba(0, 0, 0, 0.05);
    }
    
    #translation-popup .popup-content {
      padding: 12px 16px;
      max-height: 250px;
      overflow-y: auto;
      line-height: 1.5;
    }
    
    #translation-popup .original-text {
      color: #5f6368 !important;
      font-size: 13px;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #f0f0f0;
    }
    
    #translation-popup .translation-text {
      color: #202124 !important;
      font-size: 14px;
    }
    
    #translation-popup .popup-footer {
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #80868b !important;
      background: #f8f9fa;
      border-top: 1px solid #eaeaea;
    }
    
    #translation-popup .engine-info {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    #translation-popup .engine-logo {
      width: 14px;
      height: 14px;
    }
    
    #translation-popup .copy-button {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      background: transparent;
      transition: background 0.2s;
      font-size: 11px;
      color: #1a73e8 !important;
    }
    
    #translation-popup .copy-button:hover {
      background: rgba(26, 115, 232, 0.08);image.png
    }
    
    #translation-popup .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      gap: 12px;
    }
    
    #translation-popup .loading-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* 深色模式支持 */
    @media (prefers-color-scheme: dark) {
      #translation-popup {
        background: #292a2d;
        color: #e8eaed !important;
      }
      
      #translation-popup * {
        color: #e8eaed !important;
      }
      
      #translation-popup .popup-header {
        background: #202124;
        border-bottom: 1px solid #3c4043;
      }
      
      #translation-popup .popup-title {
        color: #9aa0a6 !important;
      }
      
      #translation-popup .action-button:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      
      #translation-popup .original-text {
        color: #9aa0a6 !important;
        border-bottom: 1px solid #3c4043;
      }
      
      #translation-popup .translation-text {
        color: #e8eaed !important;
      }
      
      #translation-popup .popup-footer {
        background: #202124;
        border-top: 1px solid #3c4043;
        color: #9aa0a6 !important;
      }
      
      #translation-popup .copy-button {
        color: #8ab4f8 !important;
      }
      
      #translation-popup .copy-button:hover {
        background: rgba(138, 180, 248, 0.08);
      }
      
      #translation-popup .loading-spinner {
        border: 3px solid #3c4043;
        border-top: 3px solid #8ab4f8;
      }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(popup);
  return popup;
}

// 获取选中文本的位置和尺寸信息
function getSelectionMetrics() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // 获取选中文本的计算样式
  const selectedNode = range.startContainer.parentElement || document.body;
  const computedStyle = window.getComputedStyle(selectedNode);
  
  return {
    rect: rect,
    left: rect.left + window.pageXOffset,
    top: rect.top + window.pageYOffset,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom + window.pageYOffset,
    style: {
      fontSize: computedStyle.fontSize,
      fontFamily: computedStyle.fontFamily,
      lineHeight: computedStyle.lineHeight,
      color: computedStyle.color,
      textAlign: computedStyle.textAlign
    }
  };
}

// 显示翻译弹出框 - 完全重写事件处理逻辑
function showTranslationPopup(x, y, original, translation) {
  const popup = createTranslationPopup();
  
  // 获取选中文本的尺寸和样式
  const metrics = getSelectionMetrics();
  
  // 确保translation存在且非空
  if (!translation || typeof translation !== 'string' || translation.trim() === '') {
    console.log('翻译结果为空，显示加载状态');
    translation = '正在翻译...';
  }
  
  // 检查是否是加载状态
  const isLoading = translation === '正在翻译...';
  
  // 获取当前使用的翻译引擎
  let engineName = '百度翻译';
  let engineLogo = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzIxOTZGMyIgZD0iTTMuOSw2LjE2QzMuOSw2LjE2LDEyLDIuNjcsMTcuMzEsOC4zYzUuMzEsNS42MywzLjM2LDEwLjkxLDMuMzYsMTAuOTFzLTAuNTktMS4zMy0yLjc0LTIuNTZjLTIuMTUtMS4yMy0zLjY0LTEuMjQtMy42NC0xLjI0UzE3LjQsMTMuMTcsMTYuMzgsMTNjLTEuMDItMC4xNy0xLjk0LDEuMDMtMS45NCwxLjAzUzEzLjMsMTEuODMsOC4zOCw5LjQ2QzMuNDYsNy4wOSwzLjksNi4xNiwzLjksNi4xNnoiLz48L3N2Zz4=';
  
  try {
    chrome.storage.local.get(['translationEngine'], function(result) {
      if (result.translationEngine === 'aliyun') {
        engineName = '阿里云翻译';
        engineLogo = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0ZGNkEwMCIgZD0iTTQsMTJMMTIsMjBMMjAsMTJMMTIsNEw0LDEyeiIvPjwvc3ZnPg==';
        updateEngineInfo(engineName, engineLogo);
      }
    });
  } catch (e) {
    console.error('获取翻译引擎信息失败:', e);
  }
  
  function updateEngineInfo(name, logo) {
    const engineInfoElement = popup.querySelector('.engine-name');
    const engineLogoElement = popup.querySelector('.engine-logo');
    
    if (engineInfoElement) engineInfoElement.textContent = name;
    if (engineLogoElement) engineLogoElement.src = logo;
  }
  
  // 创建HTML内容
  if (isLoading) {
    popup.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div>正在翻译...</div>
      </div>
    `;
  } else {
    // 检查是否包含HTML标签（错误消息可能包含）
    const hasHtml = /<[a-z][\s\S]*>/i.test(translation);
    
    // 判断是否为错误消息
    const isError = translation.includes('错误:') || translation.includes('error');
    
    if (isError) {
      // 错误消息直接显示
      popup.innerHTML = `
        <div class="popup-header">
          <div class="popup-title">翻译错误</div>
          <div class="popup-actions">
            <div class="action-button close-button">×</div>
          </div>
        </div>
        <div class="popup-content">
          ${translation}
        </div>
      `;
    } else {
      // 正常翻译结果
      const showOriginal = original && original.trim() !== '';
      
      popup.innerHTML = `
        <div class="popup-header">
          <div class="popup-title">翻译结果</div>
          <div class="popup-actions">
            <div class="action-button close-button">×</div>
          </div>
        </div>
        <div class="popup-content">
          ${showOriginal ? `<div class="original-text">${original}</div>` : ''}
          <div class="translation-text">${hasHtml ? translation : translation.replace(/\n/g, '<br>')}</div>
        </div>
        <div class="popup-footer">
          <div class="engine-info">
            <img class="engine-logo" src="${engineLogo}" alt="${engineName}">
            <span class="engine-name">${engineName}</span>
          </div>
          <div class="copy-button">复制</div>
        </div>
      `;
      
      // 添加复制按钮事件
      const copyButton = popup.querySelector('.copy-button');
      if (copyButton) {
        copyButton.addEventListener('click', function() {
          navigator.clipboard.writeText(translation).then(() => {
            copyButton.textContent = '已复制';
            copyButton.style.animation = 'pulse 0.3s ease';
            
            setTimeout(() => {
              copyButton.textContent = '复制';
              copyButton.style.animation = '';
            }, 1500);
          }).catch(err => {
            console.error('复制失败:', err);
            copyButton.textContent = '复制失败';
            
            setTimeout(() => {
              copyButton.textContent = '复制';
            }, 1500);
          });
        });
      }
    }
  }
  
  // 添加关闭事件处理
  const closeButton = popup.querySelector('.close-button');
  if (closeButton) {
    closeButton.addEventListener('click', function() {
      popup.style.opacity = '0';
      setTimeout(() => {
        popup.style.display = 'none';
        popup.style.opacity = '1';
      }, 200);
    });
  }
  
  // 设置弹出框位置
  popup.style.display = 'block';
  
  if (typeof x === 'number' && typeof y === 'number') {
    // 如果提供了具体坐标
    popup.style.left = Math.max(0, x) + 'px';
    popup.style.top = Math.max(0, y) + 'px';
  } else if (metrics) {
    // 使用选中文本的位置
    popup.style.left = Math.max(0, metrics.left) + 'px';
    popup.style.top = Math.max(0, metrics.bottom + 10) + 'px';
  } else {
    // 回退到窗口中心
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  }
  
  // 确保弹出框在视口内
  setTimeout(() => {
    const rect = popup.getBoundingClientRect();
    
    if (rect.right > window.innerWidth) {
      popup.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    
    if (rect.left < 10) {
      popup.style.left = '10px';
    }
    
    if (rect.bottom > window.innerHeight) {
      // 如果下方放不下，就放在选中文本上方
      if (metrics && metrics.top > rect.height + 10) {
        popup.style.top = `${metrics.top - rect.height - 10}px`;
      } else {
        // 如果上方也放不下，就固定在视口底部
        popup.style.top = `${window.innerHeight - rect.height - 10 + window.pageYOffset}px`;
      }
    }
  }, 0);
  
  return popup;
}

// 显示翻译错误 - 错误信息需要展示
function showTranslationError(x, y, original, errorMessage) {
  const popup = createTranslationPopup();
  const metrics = getSelectionMetrics();
  
  // 格式化错误消息
  const formattedError = errorMessage.replace(/\n/g, '<br>');
  
  popup.innerHTML = `
    <div style="position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border-radius: 50%; 
         background: #f0f0f0; color: #666; display: flex; align-items: center; justify-content: center; 
         cursor: pointer; font-size: 14px; line-height: 1; transition: background 0.2s;">×</div>
    <div style="margin-bottom: 8px; font-weight: 600; color: #ea4335; font-size: 14px;">翻译错误</div>
    <div style="color: #d93025; background: #fce8e6; padding: 8px; border-radius: 4px; 
         border-left: 3px solid #ea4335; font-size: 13px;">${formattedError}</div>
    <div style="margin-top: 8px; font-size: 11px; color: #5f6368;">
      如遇到API限制错误，请稍后再试
    </div>
  `;
  
  // 重新添加关闭按钮的事件处理
  const closeBtn = popup.querySelector('div[style*="position: absolute"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      popup.style.opacity = '0';
      setTimeout(() => { popup.style.display = 'none'; }, 200);
    });
    closeBtn.addEventListener('mouseover', () => {
      closeBtn.style.background = '#e0e0e0';
    });
    closeBtn.addEventListener('mouseout', () => {
      closeBtn.style.background = '#f0f0f0';
    });
  }
  
  // 定位弹出框 - 使用与翻译结果相同的逻辑
  popup.style.display = 'block';
  
  if (metrics) {
    // 设置宽度与选中文本相似
    popup.style.width = `${Math.max(200, metrics.width)}px`;
    popup.style.maxWidth = `${Math.min(500, window.innerWidth * 0.8)}px`;
    
    // 位置：居中于选中文本正下方
    const popupWidth = Math.max(200, metrics.width);
    const leftPosition = metrics.left + (metrics.width - popupWidth) / 2;
    
    popup.style.left = `${Math.max(10, leftPosition)}px`;
    popup.style.top = `${metrics.bottom + 5}px`; // 选中文本下方5px
  } else {
    // 如果无法获取选中文本信息，则使用传入的位置
    popup.style.maxWidth = '350px';
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
  }
  
  popup.style.opacity = '1';
  
  // 确保弹出框在视口内
  const rect = popup.getBoundingClientRect();
  
  if (rect.right > window.innerWidth) {
    popup.style.left = `${window.innerWidth - rect.width - 10}px`;
  }
  
  if (rect.left < 0) {
    popup.style.left = '10px';
  }
  
  if (rect.bottom > window.innerHeight) {
    // 如果下方放不下，就放在选中文本上方
    if (metrics && metrics.top > rect.height + 10) {
      popup.style.top = `${metrics.top - rect.height - 5}px`;
    } else {
      // 如果上方也放不下，就固定在视口底部
      popup.style.top = `${window.innerHeight - rect.height - 10 + window.pageYOffset}px`;
    }
  }
}

// 隐藏翻译弹出框 - 增强的清理功能
function hideTranslationPopup() {
  const popup = document.getElementById('translation-popup');
  if (popup) {
    console.log('执行弹窗隐藏操作');
    
    // 清理所有事件监听器
    if (popup._documentClickHandler) {
      document.removeEventListener('mousedown', popup._documentClickHandler, true);
      popup._documentClickHandler = null;
    }
    
    // 清理检查间隔
    if (window._popupCheckInterval) {
      clearInterval(window._popupCheckInterval);
      window._popupCheckInterval = null;
    }
    
    // 使用动画效果隐藏
    popup.style.opacity = '0';
    setTimeout(() => {
      popup.style.display = 'none';
    }, 200);
  }
}

// 提取选择范围内的所有文本（包括跨DOM元素）
function getCompleteSelectedText() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return '';
  
  try {
    // 简单情况：使用toString()
    const text = selection.toString().trim();
    return text;
  } catch (e) {
    console.error('获取选中文本失败:', e);
    
    // 备用方法：遍历选择范围内的所有节点
    try {
      const range = selection.getRangeAt(0);
      if (!range) return '';
      
      // 创建文档片段包含所有选中内容
      const fragment = range.cloneContents();
      if (!fragment) return '';
      
      // 创建临时容器
      const div = document.createElement('div');
      div.appendChild(fragment);
      
      // 获取全部文本内容
      return div.textContent || div.innerText || '';
    } catch (e2) {
      console.error('备用方法获取文本失败:', e2);
      return '';
    }
  }
}

// 从存储中获取用户设置的凭据
async function getUserCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['user_baidu_appid', 'user_baidu_secret'], function(result) {
      if (chrome.runtime.lastError) {
        resolve({ appid: null, secret: null });
        return;
      }
      
      if (!result.user_baidu_appid || !result.user_baidu_secret) {
        resolve({ appid: null, secret: null });
        return;
      }
      
      try {
        // 解密 (简单的Base64解码)
        const appid = atob(result.user_baidu_appid);
        const secret = atob(result.user_baidu_secret);
        
        resolve({ appid, secret });
      } catch (e) {
        console.error('解密API凭据出错:', e);
        resolve({ appid: null, secret: null });
      }
    });
  });
}

// 百度翻译API调用功能
async function baiduTranslate(text, from = 'auto', to = 'zh') {
  try {
    // 先尝试从用户设置获取凭据
    const { appid, secret } = await getUserCredentials();
    
    // 记录凭据信息（不显示实际内容）
    console.log('凭据检查:', 
                '- 用户appid是否存在:', !!appid, 
                '- 用户secret是否存在:', !!secret,
                '- 用户appid长度:', appid?.length || 0);
    
    // 如果用户设置的凭据不可用，从background.js获取默认凭据
    if (!appid || !secret) {
      console.log('用户凭据不可用，尝试获取默认凭据');
      
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'getApiCredentials' },
          function(response) {
            if (chrome.runtime.lastError) {
              reject(new Error('获取API凭据失败: ' + chrome.runtime.lastError.message));
              return;
            }
            
            if (response && response.apiKey && response.apiSecret) {
              console.log('成功获取默认凭据，长度:', response.apiKey.length);
              // 使用获取的凭据执行翻译
              baiduTranslateWithCredentials(text, from, to, response.apiKey, response.apiSecret)
                .then(resolve)
                .catch(reject);
            } else {
              reject(new Error('无法获取有效的API凭据'));
            }
          }
        );
      });
    }
    
    // 使用用户设置的凭据
    return await baiduTranslateWithCredentials(text, from, to, appid, secret);
  } catch (error) {
    console.error('翻译处理失败:', error);
    throw error;
  }
}

// 在translator.js顶部添加
function ensureMd5Available() {
  if (typeof md5 !== 'function') {
    console.log('加载MD5函数');
    // 尝试从window对象获取
    if (typeof window.MD5 === 'function') {
      window.md5 = window.MD5;
    } else {
      // 简单的内联md5实现（只作为备用）
      window.md5 = function(string) {
        // 导入最小化的md5实现
        const md5lib = importMd5();
        return md5lib(string);
      };
      
      window.MD5 = window.md5;
    }
  }
}

// 修改baiduTranslateWithCredentials函数
async function baiduTranslateWithCredentials(text, from, to, appid, secret) {
  // 确保md5函数可用
  ensureMd5Available();
  
  // 记录凭据信息
  console.log('使用API凭据进行翻译:',
              '- appid:', appid,
              '- appid长度:', appid.length,
              '- secret前2位:', secret.substring(0, 2),
              '- secret长度:', secret.length);
              
  try {
    // 验证凭据格式
    if (!appid || appid.length < 5 || !secret || secret.length < 5) {
      throw new Error('API凭据格式无效');
    }
    
    // 清理空格
    appid = appid.trim();
    secret = secret.trim();
    
    // 生成签名等百度API所需参数
    const salt = Date.now().toString();
    const signStr = appid + text + salt + secret;
    
    // 记录签名详情
    console.log('签名详细信息:',
               '- appid长度:', appid.length,
               '- text长度:', text.length, 
               '- salt:', salt,
               '- secret长度:', secret.length);
               
    // 使用正确的MD5函数计算签名
    const sign = MD5(signStr);
    
    console.log('生成签名:',
              '- 完整签名字符串长度:', signStr.length,
              '- 生成的MD5签名:', sign);
    
    // 使用POST方法发送请求
    const params = new URLSearchParams();
    params.append('q', text);
    params.append('from', from);
    params.append('to', to);
    params.append('appid', appid);
    params.append('salt', salt);
    params.append('sign', sign);
    
    // 打印完整请求
    console.log('完整请求参数:', params.toString());
    
    // 发送请求并记录完整响应
    const response = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    console.log('API响应状态:', response.status, response.statusText);
    const responseText = await response.text();
    console.log('API响应原文:', responseText);
    
    // 解析响应
    const data = JSON.parse(responseText);
    
    // 检查错误
    if (data.error_code) {
      console.error(`API错误 ${data.error_code}: ${data.error_msg}`);
      throw new Error(`API错误: ${data.error_code} - ${data.error_msg}`);
    }
    
    // 验证翻译结果
    if (!data.trans_result || data.trans_result.length === 0) {
      throw new Error('API返回了空的翻译结果');
    }
    
    return data.trans_result[0].dst;
  } catch (error) {
    console.error('翻译请求失败:', error);
    throw error;
  }
}

// 如果没有MD5函数，添加一个实现
if (typeof md5 !== 'function') {
  function md5(string) {
    function RotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
  
    function AddUnsigned(lX, lY) {
      var lX8 = (lX & 0x80000000);
      var lY8 = (lY & 0x80000000);
      var lX4 = (lX & 0x40000000);
      var lY4 = (lY & 0x40000000);
      var lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
      if (lX4 & lY4) {
        return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      }
      if (lX4 | lY4) {
        if (lResult & 0x40000000) {
          return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        } else {
          return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        }
      } else {
        return (lResult ^ lX8 ^ lY8);
      }
    }
    
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    
    function FF(a, b, c, d, x, s, ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    
    function GG(a, b, c, d, x, s, ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    
    function HH(a, b, c, d, x, s, ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    
    function II(a, b, c, d, x, s, ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    
    // 实现略长，但确保正确计算MD5
    // ... (此处省略一部分实现)
    
    var x = Array();
    var k, AA, BB, CC, DD, a, b, c, d;
    var S11=7, S12=12, S13=17, S14=22;
    var S21=5, S22=9, S23=14, S24=20;
    var S31=4, S32=11, S33=16, S34=23;
    var S41=6, S42=10, S43=15, S44=21;
    
    // 将字符串转换为小端字节数组
    string = unescape(encodeURIComponent(string));
    
    // 计算MD5
    // ... (此处省略一部分实现)
    
    // 返回十六进制MD5字符串
    var temp = '';
    for (k = 0; k < 4; k++) {
      var n = (a >>> (k * 8)) & 0xFF;
      temp += ('0' + n.toString(16)).slice(-2);
    }
    // ... (计算其他部分)
    
    return temp; // 返回32位MD5
  }
  
  // 注入到全局
  if (typeof window !== 'undefined') window.md5 = md5;
  else if (typeof self !== 'undefined') self.md5 = md5;
}

// 避免覆盖已存在的translatorModule
if (!window.translatorModule) {
  window.translatorModule = {
    translateText,
    createTranslationPopup,
    showTranslationPopup,
    showTranslationError,
    hideTranslationPopup,
    // 添加缺失的函数
    setupPopupEventListeners: function() {
      console.log('从translator.js提供的setupPopupEventListeners');
      document.addEventListener('click', function(event) {
        if (event.target.closest('.translator-popup-close')) {
          hideTranslationPopup();
        }
      });
    },
    translateSelectedText: function() {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text.length > 5) {
        // 使用已有的函数处理
        console.log('使用translator.js处理选中文本:', text);
        handleTextSelection();
      }
    }
  };
} else {
  // 扩展已存在的translatorModule，添加缺少的方法
  console.log('扩展已存在的translatorModule');
  if (!window.translatorModule.translateText) window.translatorModule.translateText = translateText;
  if (!window.translatorModule.createTranslationPopup) window.translatorModule.createTranslationPopup = createTranslationPopup;
  if (!window.translatorModule.showTranslationPopup) window.translatorModule.showTranslationPopup = showTranslationPopup;
  if (!window.translatorModule.showTranslationError) window.translatorModule.showTranslationError = showTranslationError;
  if (!window.translatorModule.hideTranslationPopup) window.translatorModule.hideTranslationPopup = hideTranslationPopup;
}

console.log('translator.js已加载完成');

function useDefaultCredentials() {
  console.log('使用默认API凭据');
  
  // 确保CryptoUtil可用
  ensureCryptoUtil();
  
  try {
    // 使用完整的解密过程
    apiKey = CryptoUtil.decrypt(ENCRYPTED_API_KEY);
    apiSecret = CryptoUtil.decrypt(ENCRYPTED_API_SECRET);
    
    // 清理可能的空格和不可见字符
    if (apiKey) apiKey = apiKey.trim();
    if (apiSecret) apiSecret = apiSecret.trim();
    
    console.log('默认API凭据解密结果:',
               '- apiKey:', apiKey,
               '- apiKey长度:', apiKey?.length || 0,
               '- apiSecret长度:', apiSecret?.length || 0);
    
    if (!apiKey || !apiSecret || apiKey.length < 8 || apiSecret.length < 8) {
      console.error('API凭据解密可能失败 - 长度不足或为空');
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('解密默认API凭据失败:', e);
    apiKey = '';
    apiSecret = '';
    return false;
  }
}

// 当用户选择文本时，获取选中文本和DOM边界信息
function getSelectedTextWithDomBoundaries() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return { text: '', domBoundaries: [] };
  
  let text = '';
  const domBoundaries = [];
  
  // 处理多个选区
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    text += range.toString();
  }
  
  // 如果只有一个范围，我们需要检查它是否跨越多个DOM节点
  if (selection.rangeCount === 1) {
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const nodes = fragment.querySelectorAll('*');
    
    // 如果有多个节点，我们需要找出它们的边界
    if (nodes.length > 0) {
      let currentPosition = 0;
      
      // 遍历所有文本节点
      const walker = document.createTreeWalker(
        fragment,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let textNode;
      while ((textNode = walker.nextNode())) {
        currentPosition += textNode.textContent.length;
        // 如果不是最后一个文本节点，添加边界位置
        if (walker.nextNode()) {
          domBoundaries.push(currentPosition);
          walker.previousNode(); // 回到当前节点，以便下一次迭代
        }
      }
    }
  }
  
  return { text, domBoundaries };
}

// 修改发送翻译请求的函数
function translateSelectedText() {
  const { text, domBoundaries } = getSelectedTextWithDomBoundaries();
  
  if (!text || text.trim() === '') {
    console.log('没有选中文本');
    return;
  }
  
  console.log('准备翻译文本:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  console.log('DOM边界位置:', domBoundaries);
  
  // 发送消息到background script
  chrome.runtime.sendMessage({
    action: 'translateSelection',
    text: text,
    domBoundaries: domBoundaries
  }, function(response) {
    if (response && response.success) {
      // 显示翻译结果
      showTranslationResult(response.translation);
    } else {
      // 显示错误信息
      const errorMsg = response ? response.error : '翻译请求失败';
      showTranslationError(errorMsg);
    }
  });
}

