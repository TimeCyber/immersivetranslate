console.log('简化版翻译插件已加载');

// 全局变量声明
let translationMode = 'normal';  // 默认翻译模式
let targetLanguage = 'zh-CN';    // 默认目标语言
let autoTranslateEnabled = false; // 默认自动翻译设置
let isExtensionReady = false;    // 扩展是否准备就绪
let popup = null; // 翻译弹出框
let lastSelection = null; // 上次选择的文本
let isTranslating = false; // 添加一个标志，表示是否正在翻译

// 日志函数，添加错误处理
function log(...args) {
  try {
    console.log('[Content]', ...args);
  } catch (e) {
    // 忽略日志错误
  }
}

// 检查扩展是否就绪
function checkExtensionReady() {
  log('检查扩展状态...');
  return new Promise((resolve) => {
    try {
      // 发送ping消息检查background是否响应
      sendMessageSafely({ action: 'ping' }, function(response) {
        if (response && response.success) {
          log('扩展已激活并能正常响应');
          resolve(true);
        } else {
          log('扩展未响应或未激活');
          resolve(false);
        }
      });
    } catch (error) {
      log('检查扩展状态失败:', error);
      resolve(false);
    }
  });
}

// 创建必要的UI元素
function setupUI() {
  console.log('设置翻译界面');
  
  // 检查translatorModule是否可用
  if (!window.translatorModule) {
    console.error('翻译模块未加载!');
    // 尝试重新加载模块
    loadTranslatorModule();
    return;
  }
  
  // 检查所需方法是否存在
  console.log('可用的translatorModule方法:', Object.keys(window.translatorModule).join(', '));
  
  if (typeof window.translatorModule.setupPopupEventListeners !== 'function') {
    console.error('setupPopupEventListeners方法未定义!');
    // 重新加载模块
    window.translatorModule = null;
    loadTranslatorModule();
    return;
  }
  
  try {
    // 设置翻译弹出框事件监听器
    window.translatorModule.setupPopupEventListeners();
    
    // 注意：不在这里添加mouseup事件监听器，避免重复
    // 所有的mouseup事件监听都统一在initialize函数中处理
    
    console.log('翻译界面设置完成');
  } catch (error) {
    console.error('设置翻译界面失败:', error);
  }
}

// 加载翻译模块
function loadTranslatorModule() {
  console.log('加载翻译模块');
  
  // 防止重复加载
  const existingScript = document.querySelector('script[src*="translator-module.js"]');
  if (existingScript) {
    document.head.removeChild(existingScript);
  }
  
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('scripts/translator-module.js');
  script.onload = function() {
    console.log('翻译模块加载完成');
    
    // 验证模块是否正确加载
    if (!window.translatorModule || typeof window.translatorModule.setupPopupEventListeners !== 'function') {
      console.error('翻译模块未正确加载，将延迟重试');
      setTimeout(() => {
        // 如果模块未正确加载，延迟重试
        if (!window.translatorModule || typeof window.translatorModule.setupPopupEventListeners !== 'function') {
          console.error('重试加载翻译模块');
          loadTranslatorModule();
        } else {
          setupUI();
        }
      }, 500);
    } else {
      setupUI();
    }
  };
  script.onerror = function(error) {
    console.error('加载翻译模块失败:', error);
  };
  document.head.appendChild(script);
}

// 确保API凭据
function ensureApiCredentials() {
  console.log('确保API凭据已加载');
  
  // 获取当前翻译器信息
  chrome.runtime.sendMessage({ action: "getTranslatorInfo" }, function(response) {
    if (response && response.success) {
      console.log('当前翻译器:', response.currentTranslator);
      console.log('百度翻译可用:', response.baiduAvailable);
      console.log('阿里云翻译可用:', response.aliyunAvailable);
      
      // 如果当前翻译器不可用，尝试切换到另一个可用的翻译器
      if (response.currentTranslator === 'baidu' && !response.baiduAvailable && response.aliyunAvailable) {
        switchTranslator('aliyun');
      } else if (response.currentTranslator === 'aliyun' && !response.aliyunAvailable && response.baiduAvailable) {
        switchTranslator('baidu');
      }
    } else {
      console.error('获取翻译器信息失败');
    }
  });
}

// 切换翻译器
function switchTranslator(translator) {
  console.log('切换翻译器到:', translator);
  
  chrome.runtime.sendMessage({ 
    action: "switchTranslator", 
    translator: translator 
  }, function(response) {
    if (response && response.success) {
      console.log('翻译器已切换到:', response.currentTranslator);
      
      // 显示通知
      showTranslatorSwitchNotification(response.currentTranslator);
    } else {
      console.error('切换翻译器失败:', response ? response.error : '未知错误');
    }
  });
}

// 显示翻译器切换通知
function showTranslatorSwitchNotification(translator) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.backgroundColor = '#4CAF50';
  notification.style.color = 'white';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '5px';
  notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  notification.style.zIndex = '10000';
  notification.style.transition = 'opacity 0.5s';
  
  // 设置通知内容
  notification.textContent = translator === 'baidu' ? 
    '已切换到百度翻译' : 
    '已切换到阿里云翻译';
  
  // 添加到页面
  document.body.appendChild(notification);
  
  // 3秒后淡出
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}

// 获取选中文本及其DOM边界
function getSelectedTextWithDomBoundaries() {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  if (!text) return { text: '', domBoundaries: null };
  
  // 获取选择范围的DOM边界
  const range = selection.getRangeAt(0);
  const domBoundaries = {
    startContainer: range.startContainer,
    startOffset: range.startOffset,
    endContainer: range.endContainer,
    endOffset: range.endOffset
  };
  
  return { text, domBoundaries };
}

// 检查扩展上下文是否有效
function isExtensionContextValid() {
  try {
    // 尝试发送一个简单的消息到扩展
    chrome.runtime.sendMessage({ action: "ping" });
    return true;
  } catch (error) {
    if (error.message.includes("Extension context invalidated")) {
      console.error("[Content] 扩展上下文已失效，尝试自动恢复...");
      // 尝试自动恢复
      attemptRecovery();
      return false;
    }
    // 其他错误
    console.error("[Content] 检查扩展上下文时出错:", error);
    return false;
  }
}

// 新增：尝试恢复扩展上下文
function attemptRecovery() {
  log("尝试恢复扩展上下文...");
  
  // 清除任何可能的错误状态
  if (popup && popup.style.display === 'block') {
    popup.style.display = 'none';
  }
  
  // 重置翻译状态
  isTranslating = false;
  
  // 尝试重新连接到扩展
  setTimeout(() => {
    try {
      // 尝试重新加载页面脚本
      loadTranslatorModule();
      
      // 检查是否恢复成功
      setTimeout(() => {
        if (isExtensionContextValid()) {
          log("扩展上下文已成功恢复");
          // 可以在这里显示一个成功恢复的通知
        } else {
          // 如果恢复失败，显示一个更友好的提示，而不是错误消息
          showRecoveryFailedNotification();
        }
      }, 1000);
    } catch (e) {
      log("恢复扩展上下文失败:", e);
      showRecoveryFailedNotification();
    }
  }, 500);
}

// 新增：显示恢复失败通知
function showRecoveryFailedNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #f8d7da;
    color: #721c24;
    padding: 10px 15px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    max-width: 300px;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center;">
      <div style="margin-right: 10px;">⚠️</div>
      <div>
        <div style="font-weight: bold; margin-bottom: 5px;">翻译助手已重新加载</div>
        <div>请刷新页面以恢复完整功能，或继续使用可能会遇到问题。</div>
      </div>
    </div>
    <div style="text-align: right; margin-top: 10px;">
      <button style="background: #721c24; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">刷新页面</button>
      <button style="background: none; border: none; color: #721c24; cursor: pointer; text-decoration: underline;">忽略</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // 添加按钮事件
  const buttons = notification.querySelectorAll('button');
  if (buttons.length >= 2) {
    // 刷新按钮
    buttons[0].addEventListener('click', () => {
      window.location.reload();
    });
    
    // 忽略按钮
    buttons[1].addEventListener('click', () => {
      document.body.removeChild(notification);
    });
  }
  
  // 60秒后自动关闭
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 60000);
}

// 测试扩展连接
function testExtensionConnection() {
  try {
    log('测试扩展连接状态...');
    
    // 定义一个超时以避免永久等待
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('扩展响应超时')), 3000);
    });
    
    // 发送消息并等待响应
    const messagePromise = new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "ping" }, function(response) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.success) {
          log('扩展正常响应:', response.message);
          resolve(true);
        } else {
          log('扩展异常响应:', response);
          reject(new Error('收到异常响应'));
        }
      });
    });
    
    // 使用Promise.race来处理超时情况
    Promise.race([messagePromise, timeoutPromise])
      .then(() => {
        log('扩展连接正常');
      })
      .catch(error => {
        log('扩展连接失败:', error.message);
        // 使用备用翻译
        log('将使用备用翻译方式');
      });
  } catch (error) {
    log('测试扩展连接时发生错误:', error);
  }
}

// 安全的消息发送函数 - 添加超时和错误处理
function sendMessageSafely(message, callback) {
  try {
    // 首先检查扩展上下文是否有效
    if (!isExtensionContextValid()) {
      log('扩展上下文无效，无法发送消息');
      callback({ success: false, error: '扩展上下文无效，请刷新页面' });
      return;
    }
    
    // 定义超时
    let timeoutId = setTimeout(() => {
      log('发送消息超时');
      callback({ success: false, error: '发送消息超时' });
    }, 5000);
    
    // 发送消息
    chrome.runtime.sendMessage(message, function(response) {
      clearTimeout(timeoutId);
      
      if (chrome.runtime.lastError) {
        log('发送消息错误:', chrome.runtime.lastError);
        // 如果扩展未响应，使用备用翻译方法
        if (message.action === 'translateSelection') {
          log('将使用备用翻译...');
          fallbackTranslate(message.text, callback);
          return;
        }
        callback({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      callback(response || { success: false, error: '未收到响应' });
    });
  } catch (error) {
    log('发送消息异常:', error);
    
    // 检查是否是扩展上下文失效错误
    if (error.message.includes('Extension context invalidated')) {
      // 尝试恢复
      attemptRecovery();
      
      // 使用备用翻译
      if (message.action === 'translateSelection' && message.text) {
        log('扩展上下文失效，尝试使用备用翻译');
        fallbackTranslate(message.text, callback);
        return;
      }
    }
    
    callback({ success: false, error: error.message });
  }
}

// 备用翻译函数 - 当扩展未响应时使用
function fallbackTranslate(text, callback) {
  log('使用备用翻译方法:', text);
  
  // 使用真实的翻译API调用
  try {
    // 从存储中获取翻译设置
    chrome.storage.local.get(['translatorType'], function(result) {
      const translatorType = result.translatorType || 'baidu'; // 默认使用百度翻译
      
      log('使用真实翻译API:', translatorType);
      
      // 使用标准消息格式调用background中的翻译功能
      chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        translator: translatorType,
        source: 'auto',
        target: 'zh-CN',
        isDirectCall: true
      }, function(response) {
        // 处理直接调用的响应
        if (chrome.runtime.lastError) {
          log('备用翻译API调用失败:', chrome.runtime.lastError);
          callback({
            success: false,
            error: chrome.runtime.lastError.message || '翻译API调用失败',
            original: text
          });
          return;
        }
        
        if (response && response.success) {
          callback({
            success: true,
            translation: response.translation,
            original: text
          });
        } else {
          callback({
            success: false,
            error: response?.error || '未知错误',
            original: text
          });
        }
      });
    });
  } catch (error) {
    log('备用翻译调用失败:', error);
    // 如果直接调用API也失败，返回错误信息
    callback({
      success: false,
      error: error.message || '翻译调用异常',
      original: text
    });
  }
}

// 检查文本是否主要是中文
function isChineseText(text) {
  if (!text || text.length === 0) return false;
  
  // 中文字符的Unicode范围 - 仅包含汉字
  // CJK统一汉字 (4E00-9FFF)
  // CJK扩展A (3400-4DBF)
  // CJK扩展B-F和更多扩展
  const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/;
  
  // 计算中文字符的数量
  let chineseCount = 0;
  let totalCount = 0;
  
  // 只计算字母、数字和中文字符，忽略空格和标点符号
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // 忽略空格和常见标点符号
    if (/\s/.test(char) || /[.,;:!?()[\]{}'"，。；：！？（）【】「」''""、]/.test(char)) {
      continue;
    }
    
    totalCount++;
    if (chineseRegex.test(char)) {
      chineseCount++;
    }
  }
  
  // 如果没有有效字符，返回false
  if (totalCount === 0) return false;
  
  // 计算中文字符占比
  const chineseRatio = chineseCount / totalCount;
  
  // 添加调试日志
  log('中文检测 - 文本:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
  log('中文检测 - 中文字符数:', chineseCount, '总字符数:', totalCount, '中文占比:', chineseRatio);
  
  // 如果中文字符占比超过30%，则认为是中文文本
  return chineseRatio > 0.5;
}

// 处理选定文本的翻译
async function handleTextSelection(e) {
  try {
    // 获取选中的文本
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    // 如果没有选中文本，则不处理
    if (!selectedText) {
      return;
    }
    
    // 如果文本长度小于2，不处理
    if (selectedText.length < 2) {
      return;
    }
    
    // 检查选中文本是否在输入框内，如果是则不处理
    if (selection.rangeCount > 0) {
      const node = selection.getRangeAt(0).startContainer;
      const parentElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      
      // 检查是否在输入框内（input, textarea, [contenteditable=true]）
      const isInInputField = parentElement.closest('input, textarea, [contenteditable=true]');
      if (isInInputField) {
        return; // 在输入框内，不触发翻译
      }
    }
    
    // 检查是否是中文文本，如果是则不触发翻译
    if (isChineseText(selectedText)) {
      log('检测到中文文本，不触发翻译:', selectedText.substring(0, 20) + (selectedText.length > 20 ? '...' : ''));
      return;
    }
    
    // 如果与上次选择的文本相同，且弹出框已显示，则不重复处理
    if (selectedText === lastSelection && popup && popup.style.display === 'block') {
      return;
    }
    
    // 如果正在翻译中，不重复发送请求
    if (isTranslating) {
      return;
    }
    
    // 检查扩展上下文是否有效
    if (!isExtensionContextValid()) {
      // 如果上下文无效但我们已经尝试了恢复，继续使用备用翻译
      log('扩展上下文无效，将使用备用翻译');
    }
    
    // 更新上次选择的文本
    lastSelection = selectedText;
    
    // 处理跨DOM元素的文本，保留换行
    const processedText = processSelectedTextWithLineBreaks(selection);
    
    log('选中文本:', processedText.substring(0, 50) + (processedText.length > 50 ? '...' : ''));
    
    // 创建或获取弹出框
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'translation-popup';
      popup.style.cssText = `
        position: absolute;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9999;
        max-width: 450px;
        width: auto;
        min-width: 300px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        display: none;
      `;
      document.body.appendChild(popup);
    } else {
      // 确保使用已存在的弹出框
      popup = document.getElementById('translation-popup');
      // 更新已存在弹出框的宽度
      popup.style.maxWidth = '450px';
      popup.style.minWidth = '300px';
    }
    
    // 显示加载中状态
    popup.innerHTML = `
      <div style="position: absolute; top: 8px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
      <div style="padding: 15px;">
        <div style="display: flex; align-items: center; justify-content: center;">
          <div style="width: 20px; height: 20px; border: 2px solid #3498db; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
          <div style="margin-left: 10px;">翻译中...</div>
        </div>
      </div>
    `;
    popup.style.display = 'block';
    
    // 计算弹出框位置
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // 先设置位置
    popup.style.top = (rect.bottom + scrollTop + 10) + 'px';
    popup.style.left = (rect.left + scrollLeft) + 'px';
    
    // 显示弹出框以便获取其尺寸
    popup.style.display = 'block';
    
    // 检查是否超出右侧边界并调整
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > viewportWidth) {
      popup.style.left = Math.max(10, (viewportWidth - popupRect.width - 10 + scrollLeft)) + 'px';
    }
    
    // 检查是否超出底部边界并调整
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (popupRect.bottom > viewportHeight) {
      // 如果底部超出，尝试在选择文本上方显示
      if (rect.top > popupRect.height + 10) {
        // 上方有足够空间
        popup.style.top = (rect.top + scrollTop - popupRect.height - 10) + 'px';
      } else {
        // 上方空间不足，保持在下方但调整到视口内
        popup.style.top = Math.max(10, (viewportHeight - popupRect.height - 10 + scrollTop)) + 'px';
      }
    }
    
    // 添加关闭按钮事件
    const closeButton = popup.querySelector('div[style*="cursor: pointer"]');
    if (closeButton) {
      closeButton.addEventListener('click', function() {
        popup.style.display = 'none';
      });
    }
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    // 设置标志，表示正在翻译
    isTranslating = true;
    
    // 使用安全的消息发送函数处理翻译请求
    sendMessageSafely({
      action: 'translateSelection',
      text: processedText
    }, function(response) {
      // 翻译完成，重置标志
      isTranslating = false;
      
      log('翻译响应:', response);
      
      if (!response) {
        showErrorInPopup(popup, '未收到翻译响应');
        return;
      }
      
      if (response.success) {
        const translatedText = response.translation || '无法获取翻译';
        
        // 使用安全的方式获取当前翻译模式
        const currentMode = translationMode || 'normal';
        
        // 根据翻译模式选择显示方式
        if (currentMode === 'light') {
          // 轻量模式：只显示翻译结果
          popup.innerHTML = `
            <div style="position: absolute; top: 8px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
            <div style="padding: 15px; color: #2980b9; white-space: pre-line; overflow-wrap: break-word; word-break: break-word;">${translatedText}</div>
          `;
        } else {
          // 常规模式：显示原文和翻译结果
          popup.innerHTML = `
            <div style="position: absolute; top: 8px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
            <div style="padding: 15px;">
              <div style="margin-bottom: 8px; color: #7f8c8d; white-space: pre-line; overflow-wrap: break-word; word-break: break-word;">${processedText}</div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 10px 0;">
              <div style="color: #2980b9; white-space: pre-line; overflow-wrap: break-word; word-break: break-word;">${translatedText}</div>
            </div>
          `;
        }
        
        // 重新添加关闭按钮事件
        const closeButton = popup.querySelector('div[style*="cursor: pointer"]');
        if (closeButton) {
          closeButton.addEventListener('click', function() {
            popup.style.display = 'none';
          });
        }
      } else {
        showErrorInPopup(popup, response.error || '翻译失败');
      }
    });
  } catch (error) {
    // 出错时也要重置标志
    isTranslating = false;
    log('处理文本选择错误:', error);
    // 尝试显示错误信息在弹出框中，如果弹出框存在的话
    if (popup) {
      showErrorInPopup(popup, '处理选中文本时出错');
    }
  }
}

// 新增函数：处理选中文本，保留跨DOM元素的换行
function processSelectedTextWithLineBreaks(selection) {
  if (!selection || selection.rangeCount === 0) {
    return '';
  }
  
  // 如果只有一个范围，使用formatTextWithLineBreaks处理
  if (selection.rangeCount === 1) {
    return formatTextWithLineBreaks(selection.toString());
  }
  
  // 处理多个范围（跨DOM元素选择）
  let text = '';
  const range = selection.getRangeAt(0);
  
  // 创建一个临时容器来保存选中内容的HTML结构
  const tempDiv = document.createElement('div');
  tempDiv.appendChild(range.cloneContents());
  
  // 递归处理节点，保留DOM结构中的换行
  text = extractTextWithLineBreaks(tempDiv);
  
  // 如果上面的方法没有捕获到完整文本，回退到简单方法
  if (!text || text.trim() === '') {
    text = formatTextWithLineBreaks(selection.toString());
  }
  
  return text;
}

// 递归提取文本，保留DOM结构中的换行
function extractTextWithLineBreaks(node) {
  if (!node) return '';
  
  // 处理文本节点
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  
  // 处理元素节点
  if (node.nodeType === Node.ELEMENT_NODE) {
    let result = '';
    
    // 特殊元素处理
    if (node.tagName === 'BR') {
      return '\n';
    } else if (['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR'].includes(node.tagName)) {
      // 块级元素前后添加换行
      result = '\n';
    } else if (node.tagName === 'HR') {
      return '\n---\n';
    }
    
    // 递归处理子节点
    for (let i = 0; i < node.childNodes.length; i++) {
      result += extractTextWithLineBreaks(node.childNodes[i]);
    }
    
    // 块级元素后添加换行
    if (['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR'].includes(node.tagName)) {
      result += '\n';
    }
    
    // 清理多余的换行符
    result = result.replace(/\n{3,}/g, '\n\n');
    
    return result;
  }
  
  return '';
}

// 改进formatTextWithLineBreaks函数
function formatTextWithLineBreaks(text) {
  if (!text) return '';
  
  // 保留原始换行符
  let formattedText = text;
  
  // 检测句子结束符号后面是否紧跟大写字母开头的新句子，如果是则添加换行
  formattedText = formattedText.replace(/([.!?。！？])\s*([A-Z\u4e00-\u9fa5])/g, '$1\n$2');
  
  // 检测明显的段落边界 - 如果有连续的标点符号可能表示段落结束
  formattedText = formattedText.replace(/([.!?。！？]{1,})\s+/g, '$1\n\n');
  
  // 处理可能的列表项
  formattedText = formattedText.replace(/(\d+[.、）\)]\s*|[•◦▪-]\s*)/g, '\n$1');
  
  // 处理可能的标题（全大写行）
  formattedText = formattedText.replace(/^([A-Z\s]{5,})$/gm, '\n$1\n');
  
  // 清理多余的换行符
  formattedText = formattedText.replace(/\n{3,}/g, '\n\n');
  
  return formattedText;
}

// 添加一个辅助函数来在弹出框中显示错误信息
function showErrorInPopup(popup, errorMessage) {
  if (!popup) return;
  
  popup.innerHTML = `
    <div style="position: absolute; top: 8px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
    <div style="padding: 15px;">
      <div style="color: #e74c3c; text-align: center;">
        <div style="margin-bottom: 5px;">⚠️ 错误</div>
        <div>${errorMessage}</div>
      </div>
    </div>
  `;
  
  // 重新添加关闭按钮事件
  const closeButton = popup.querySelector('div[style*="cursor: pointer"]');
  if (closeButton) {
    closeButton.addEventListener('click', function() {
      popup.style.display = 'none';
    });
  }
}

// 添加防抖函数，避免短时间内多次触发同一事件
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// 统一的选择处理函数 - 添加防抖
const debouncedHandleTextSelection = debounce(handleTextSelection, 300);

// 统一的选择处理函数
function handleSelectionEvent(e) {
  // 忽略对翻译弹出框内的事件
  const popup = document.getElementById('translation-popup');
  if (popup && (e.target === popup || popup.contains(e.target))) {
    return;
  }
  
  // 检查是否在输入框内（input, textarea, [contenteditable=true]）
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.getAttribute('contenteditable') === 'true' || e.target.closest('input, textarea, [contenteditable=true]'))) {
    return; // 在输入框内，不触发翻译
  }
  
  // 检查选中的文本是否是中文
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  if (selectedText && isChineseText(selectedText)) {
    log('检测到中文文本，不触发翻译:', selectedText.substring(0, 20) + (selectedText.length > 20 ? '...' : ''));
    return; // 中文文本，不触发翻译
  }
  
  // 使用防抖函数处理文本选择
  debouncedHandleTextSelection(e);
}

// 在页面上添加额外的事件监听来捕捉选中事件
document.addEventListener('selectionchange', function() {
  // 检查选中文本是否在输入框内
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const node = selection.getRangeAt(0).startContainer;
    const parentElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    
    // 检查是否在输入框内（input, textarea, [contenteditable=true]）
    const isInInputField = parentElement.closest('input, textarea, [contenteditable=true]');
    if (isInInputField) {
      return; // 在输入框内，不设置选择变化标志
    }
    
    // 检查选中的文本是否是中文
    const selectedText = selection.toString().trim();
    if (selectedText && isChineseText(selectedText)) {
      return; // 中文文本，不设置选择变化标志
    }
  }
  
  // 不立即处理，而是设置一个标志表示选择已变化
  window.selectionChanged = true;
});

// 初始化
(function init() {
  // 添加MutationObserver监听DOM变化
  const observer = new MutationObserver(function(mutations) {
    // 如果选择发生了变化，并且之前没有处理过，则处理它
    if (window.selectionChanged) {
      window.selectionChanged = false;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim()) {
        // 检查选中文本是否在输入框内
        if (selection.rangeCount > 0) {
          const node = selection.getRangeAt(0).startContainer;
          const parentElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
          
          // 检查是否在输入框内（input, textarea, [contenteditable=true]）
          const isInInputField = parentElement.closest('input, textarea, [contenteditable=true]');
          if (isInInputField) {
            return; // 在输入框内，不触发翻译
          }
        }
        
        // 检查选中的文本是否是中文
        const selectedText = selection.toString().trim();
        if (isChineseText(selectedText)) {
          log('检测到中文文本，不触发翻译:', selectedText.substring(0, 20) + (selectedText.length > 20 ? '...' : ''));
          return; // 中文文本，不触发翻译
        }
        
        // 模拟一个鼠标事件以触发翻译
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const fakeEvent = {
          clientX: rect.right,
          clientY: rect.bottom,
          target: document.elementFromPoint(rect.right, rect.bottom)
        };
        handleSelectionEvent(fakeEvent);
      }
    }
  });

  // 配置观察器
  observer.observe(document, {
    attributes: true,
    attributeFilter: ['class']
  });

  // 添加翻译器脚本
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('scripts/translator.js');
  script.onload = function() {
    this.remove();
    setupUI();
  };
  (document.head || document.documentElement).appendChild(script);
})();

// 在DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  console.log('内容脚本已加载');
  
  // 确保只有一个版本的translatorModule
  if (window.translatorModule) {
    console.log('检测到已存在的translatorModule，重置');
    window.translatorModule = null;
  }
  
  // 测试扩展连接
  testExtensionConnection();
  
  // 确保先加载凭据
  ensureApiCredentials();
  
  // 延迟一点再加载模块，确保凭据已设置
  setTimeout(() => {
    loadTranslatorModule();
  }, 100);

  // 检查扩展是否有效
  try {
    // 简单的ping消息来检查扩展是否响应
    sendMessageSafely({ action: 'ping' }, function(response) {
      if (response && response.success) {
        log('扩展上下文有效');
      } else {
        log('扩展上下文可能无效:', response);
      }
    });
  } catch (e) {
    log('检查扩展状态时出错:', e);
  }
});

// 添加消息监听器，处理来自popup和background的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  log('内容脚本收到消息:', request);
  
  // 处理更新翻译状态的消息
  if (request.action === 'updateTranslationState') {
    autoTranslateEnabled = request.enabled;
    log('自动翻译状态已更新:', autoTranslateEnabled);
    sendResponse({ success: true });
  }
  
  // 处理更新翻译模式的消息
  if (request.action === 'updateTranslationMode') {
    translationMode = request.mode;
    log('翻译模式已更新:', translationMode);
    sendResponse({ success: true });
  }
  
  // 处理更新翻译结果的消息
  if (request.action === 'updateTranslation') {
    log('收到翻译结果更新:', request);
    
    // 查找当前显示的弹出框
    const popup = document.getElementById('translation-popup');
    if (popup && popup.style.display !== 'none') {
      // 获取原始文本
      const originalText = request.originalText || lastSelection || '未知原文';
      
      // 处理原始文本的换行 - 对跨DOM元素的文本进行换行处理
      const formattedOriginalText = formatTextWithLineBreaks(originalText);
      
      // 处理翻译结果的换行
      let translation = request.translation || '正在翻译...';
      const formattedTranslation = formatTextWithLineBreaks(translation);
      
      // 确保translationMode已定义
      const currentMode = translationMode || 'normal';
      
      // 根据翻译模式选择显示方式
      if (currentMode === 'light') {
        // 轻量模式：只显示翻译结果
        popup.innerHTML = `
          <div style="position: absolute; top: 8px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
          <div style="padding: 15px; color: #2980b9; white-space: pre-line; overflow-wrap: break-word; word-break: break-word;">${formattedTranslation}</div>
        `;
      } else {
        // 常规模式：显示原文和翻译结果
        popup.innerHTML = `
          <div style="position: absolute; top: 8px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
          <div style="padding: 15px;">
            <div style="margin-bottom: 8px; color: #7f8c8d; white-space: pre-line; overflow-wrap: break-word; word-break: break-word;">${formattedOriginalText}</div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 10px 0;">
            <div style="color: #2980b9; white-space: pre-line; overflow-wrap: break-word; word-break: break-word;">${formattedTranslation}</div>
          </div>
        `;
      }
      
      // 重新添加关闭按钮事件
      const closeButton = popup.querySelector('div[style*="cursor: pointer"]');
      if (closeButton) {
        closeButton.addEventListener('click', function() {
          popup.style.display = 'none';
        });
      }
    }
  }
  
  // 处理翻译错误的消息
  if (request.action === 'translationError') {
    log('收到翻译错误:', request.error);
    
    // 查找当前显示的弹出框
    const popup = document.getElementById('translation-popup');
    if (popup && popup.style.display !== 'none') {
      // 获取原始文本
      const originalText = request.originalText || lastSelection || '未知原文';
      
      // 处理原始文本的换行
      const formattedOriginalText = formatTextWithLineBreaks(originalText);
      
      // 显示错误消息
      popup.innerHTML = `
        <div style="position: absolute; top: 8px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
        <div style="padding: 15px;">
          <div style="margin-bottom: 8px; color: #7f8c8d; white-space: pre-line; overflow-wrap: break-word; word-break: break-word;">${formattedOriginalText}</div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 10px 0;">
          <div style="color: #e74c3c; overflow-wrap: break-word; word-break: break-word;">错误: ${request.error}</div>
        </div>
      `;
      
      // 添加关闭按钮事件
      const newCloseBtn = popup.querySelector('div[style*="position: absolute"]');
      if (newCloseBtn) {
        newCloseBtn.addEventListener('click', () => {
          popup.style.display = 'none';
        });
      }
    }
  }
  
  return true; // 保持消息通道开放以便异步响应
});

// 加载设置
async function loadSettings() {
  log('加载设置...');
  
  const extensionReady = await checkExtensionReady();
  
  if (extensionReady) {
    try {
      // 通过chrome.runtime.sendMessage获取设置
      chrome.runtime.sendMessage({ action: 'getSettings' }, function(response) {
        if (response && response.settings) {
          translationMode = response.settings.translationMode;
          log('从扩展获取翻译模式:', translationMode);
        } else {
          log('未能从扩展获取设置，使用默认值');
          fallbackToStorageSettings();
        }
      });
    } catch (error) {
      log('从扩展获取设置失败，尝试从storage获取:', error);
      fallbackToStorageSettings();
    }
  } else {
    log('扩展未就绪，从storage获取设置');
    fallbackToStorageSettings();
  }
}

// 立即加载设置
loadSettings();

// 添加页面可见性变化监听器，当页面从隐藏变为可见时重新检查扩展上下文
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    log('页面变为可见，检查扩展上下文');
    if (!isExtensionContextValid()) {
      // 不再只是记录错误，而是尝试恢复
      log('扩展上下文无效，尝试恢复');
      // attemptRecovery函数已经在isExtensionContextValid中调用
    }
  }
});

// 初始化函数
function initialize() {
  log('初始化翻译内容脚本');
  
  // 加载设置
  loadSettings();
  
  // 添加mouseup事件监听器，用于检测文本选择
  document.addEventListener('mouseup', function(e) {
    // 忽略来自翻译弹出框本身的点击
    if (popup && popup.contains(e.target)) {
      return;
    }
    
    // 检查是否在输入框内（input, textarea, [contenteditable=true]）
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.getAttribute('contenteditable') === 'true' || e.target.closest('input, textarea, [contenteditable=true]'))) {
      return; // 在输入框内，不触发翻译
    }
    
    // 检查选中的文本是否是中文
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText && isChineseText(selectedText)) {
      log('检测到中文文本，不触发翻译:', selectedText.substring(0, 20) + (selectedText.length > 20 ? '...' : ''));
      return; // 中文文本，不触发翻译
    }
    
    // 如果点击弹出框外部，关闭弹出框
    if (popup && popup.style.display === 'block' && !e.target.closest('#translation-popup')) {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        popup.style.display = 'none';
      }
    }
    
    // 延迟处理文本选择，确保选择已完成
    setTimeout(() => handleTextSelection(e), 200);
  });
  
  // 测试扩展连接
  testExtensionConnection();
  
  log('翻译内容脚本初始化完成');
}

// 页面加载完成后初始化
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}

log('翻译内容脚本加载完成');

// 添加错误恢复机制
function recoverFromStorageErrors() {
  // 尝试使用localStorage作为备用存储
  try {
    const backupSettings = localStorage.getItem('translationSettings');
    if (backupSettings) {
      const settings = JSON.parse(backupSettings);
      translationMode = settings.translationMode || 'normal';
      targetLanguage = settings.targetLanguage || 'zh-CN';
      autoTranslateEnabled = settings.autoTranslate?.enabled || false;
      log('从本地存储恢复设置:', settings);
    }
  } catch (e) {
    log('从备用存储恢复失败:', e);
    // 使用硬编码的默认值
    translationMode = 'normal';
    targetLanguage = 'zh-CN';
    autoTranslateEnabled = false;
  }
}

// 在初始化时调用
document.addEventListener('DOMContentLoaded', function() {
  log('内容脚本已加载，初始化设置');
  
  // 立即设置默认值
  translationMode = 'normal';
  targetLanguage = 'zh-CN';
  autoTranslateEnabled = false;
  
  // 然后尝试从存储中获取
  recoverFromStorageErrors();
});

// 从扩展获取设置
function getSettingsFromExtension() {
  return new Promise((resolve, reject) => {
    try {
      // 使用chrome.runtime.sendMessage
      chrome.runtime.sendMessage({ action: 'getSettings' }, function(response) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.settings) {
          resolve(response.settings);
        } else {
          reject(new Error('未收到有效的设置数据'));
        }
      });
      
      // 设置超时
      setTimeout(() => {
        reject(new Error('从扩展获取设置超时'));
      }, 3000);
    } catch (error) {
      reject(error);
    }
  });
}

// 从storage获取设置的回退函数
function fallbackToStorageSettings() {
  chrome.storage.local.get(['translationMode'], function(result) {
    try {
      // 设置翻译模式
      if (result && result.translationMode) {
        translationMode = result.translationMode;
        log('已加载翻译模式:', translationMode);
      } else {
        // 默认使用轻量模式
        translationMode = 'light';
        // 保存默认设置
        chrome.storage.local.set({ 'translationMode': 'light' });
        log('使用默认翻译模式:', translationMode);
      }
    } catch (error) {
      log('加载设置时出错:', error);
    }
  });
} 