let translator = new Translator();
let isEnabled = false;
let originalTexts = new Map(); // 保存原始文本
let translatedNodes = new Set(); // 跟踪已翻译的节点
let lightweightMode = false;

// 添加在文件开头附近
function logDebug(message, data) {
  console.log(`%c[翻译插件] ${message}`, 'background: #f0f0f0; color: #0078d7', data || '');
}

// 初始化
(function() {
  logDebug('内容脚本已加载');
  
  // 检查URL是否包含技术文档特征
  const url = window.location.href;
  if (url.includes('learning/tutorials') || 
      url.includes('documentation') || 
      url.includes('docs') ||
      url.includes('guides')) {
    console.log('检测到技术文档页面，启用轻量级模式');
    lightweightMode = true;
  }
  
  // 检查翻译是否启用
  chrome.storage.sync.get(['enabled', 'apiKey', 'apiSecret'], function(result) {
    isEnabled = result.enabled || false;
    logDebug(`翻译状态: ${isEnabled ? '已启用' : '未启用'}`);
    logDebug(`API配置: ${result.apiKey ? '已设置' : '未设置'}`);
    
    if (isEnabled) {
      translatePage();
    }
  });
  
  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "toggleTranslation") {
      isEnabled = request.enabled;
      
      if (isEnabled) {
        translatePage();
      } else {
        restoreOriginalText();
      }
      
      sendResponse({success: true});
    } else if (request.action === "setTranslationMode") {
      // 处理模式切换
      lightweightMode = request.mode === 'lightweight';
      console.log(`翻译模式已切换为: ${lightweightMode ? '轻量' : '常规'}`);
      
      // 清除当前翻译，重新开始
      restoreOriginalText();
      if (isEnabled) {
        translatePage();
      }
      
      sendResponse({success: true});
    }
    return true;
  });
  
  // Epic Games 技术文档特定处理
  if (window.location.href.includes('epicgames.com/community/learning')) {
    console.log('检测到Epic Games技术文档，应用特定优化');
    
    // 强制使用轻量级模式
    lightweightMode = true;
    
    // 等待页面完全加载后再翻译
    window.addEventListener('load', function() {
      // 特定优化：排除代码块和技术术语
      const codeBlocks = document.querySelectorAll('pre, code, .code-block');
      codeBlocks.forEach(block => {
        block.setAttribute('data-no-translate', 'true');
      });
      
      // 仅在页面完全加载后开始翻译
      setTimeout(() => {
        if (isEnabled) translatePage();
      }, 1000);
    });
  }
})();

// 翻译页面
async function translatePage() {
  if (!isEnabled) {
    logDebug('翻译未启用，跳过翻译');
    return;
  }
  
  console.log('开始翻译页面，轻量级模式:', lightweightMode);
  
  if (lightweightMode) {
    // 轻量级模式: 仅翻译主要内容区域的标题和段落
    await translateLightweight();
  } else {
    // 常规模式: 翻译所有文本节点
    await translateRegular();
  }
}

// 新增轻量级翻译函数 - 只翻译重要内容
async function translateLightweight() {
  // 查找主要内容区域（根据Epic Games文档页面结构调整选择器）
  const mainContent = document.querySelector('.tutorial-content') || 
                      document.querySelector('article') || 
                      document.querySelector('.main-content') ||
                      document.body;
  
  // 仅选择主要标题和正文段落
  const elements = mainContent.querySelectorAll('h1, h2, h3, h4, p');
  console.log(`轻量模式: 找到 ${elements.length} 个主要元素`);
  
  // 每批处理的元素数量
  const BATCH_SIZE = 5;
  
  // 分批处理
  for (let i = 0; i < elements.length; i += BATCH_SIZE) {
    const batch = Array.from(elements).slice(i, i + BATCH_SIZE);
    
    // 并行处理当前批次
    await Promise.all(batch.map(async (element) => {
      try {
        // 跳过代码块、已翻译内容和空内容
        if (element.closest('pre, code') || 
            translatedNodes.has(element) ||
            !element.textContent.trim()) {
          return;
        }
        
        // 检查是否为英文内容
        const text = element.textContent.trim();
        if (!translator.isEnglish(text)) return;
        
        // 保存原始内容引用
        originalTexts.set(element, element.innerHTML);
        translatedNodes.add(element);
        
        // 限制翻译文本长度
        const textToTranslate = text.length > 500 ? 
                                text.substring(0, 500) + "..." : 
                                text;
        
        // 翻译此元素的文本
        const translated = await translator.translateText(textToTranslate);
        
        // 如果翻译成功，替换内容
        if (translated && translated !== textToTranslate) {
          // 为翻译文本添加样式，便于识别
          element.innerHTML = `<span class="translated-text" style="color:inherit;">${translated}</span>`;
        }
      } catch (error) {
        console.error('翻译元素时出错:', error);
      }
    }));
    
    // 每批处理后暂停，降低内存压力
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 主动提示垃圾回收
    if (window.gc) window.gc();
  }
}

// 保留原translatePage并重命名为translateRegular
async function translateRegular() {
  logDebug('开始翻译页面');
  const textNodes = getTextNodes(document.body);
  logDebug(`找到 ${textNodes.length} 个文本节点`);
  
  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    
    // 跳过已翻译的节点
    if (translatedNodes.has(node)) continue;
    
    const text = node.nodeValue.trim();
    
    // 跳过空文本或非英文文本
    if (!text || !translator.isEnglish(text)) continue;
    
    // 生成唯一标识符
    const nodeId = `node_${Date.now()}_${i}`;
    
    // 保存原始文本
    originalTexts.set(node, text);
    
    // 标记为已翻译
    translatedNodes.add(node);
    
    // 翻译文本
    const translatedText = await translator.translateText(text, nodeId);
    
    // 更新节点文本
    if (translatedText !== text) {
      node.nodeValue = translatedText;
    }
  }
}

// 恢复原始文本
function restoreOriginalText() {
  originalTexts.forEach((text, node) => {
    if (node.nodeValue) {
      node.nodeValue = text;
    }
  });
  
  translatedNodes.clear();
  originalTexts.clear();
}

// 获取所有文本节点
function getTextNodes(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // 排除空文本节点和应忽略的标签内的节点
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        
        const parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        // 排除被标记为不翻译的元素
        if (parent.getAttribute && parent.getAttribute('data-no-translate') === 'true') {
          return NodeFilter.FILTER_REJECT;
        }
        
        if (translator.IGNORE_TAGS.has(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  // 限制处理的节点数量
  const maxNodes = lightweightMode ? 100 : 500;
  const textNodes = [];
  let node;
  let count = 0;
  
  while ((node = walker.nextNode()) && count < maxNodes) {
    textNodes.push(node);
    count++;
  }
  
  return textNodes;
}

// 监听DOM变化，处理动态加载的内容
const observer = new MutationObserver(mutations => {
  if (!isEnabled) return;
  
  let hasNewTextNodes = false;
  
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          hasNewTextNodes = true;
        }
      });
    }
  });
  
  if (hasNewTextNodes) {
    translatePage();
  }
});

// 配置观察选项
observer.observe(document.body, {
  childList: true,
  subtree: true
});

function displayTranslationResult(result) {
  const translationElement = document.getElementById('translation-result');
  
  if (result.success) {
    // 将换行符转换为<br>标签
    const formattedTranslation = result.translation.replace(/\n/g, '<br>');
    
    // 使用innerHTML而不是textContent，以便正确渲染HTML标签
    translationElement.innerHTML = formattedTranslation;
  } else {
    translationElement.textContent = `翻译错误: ${result.error}`;
  }
}

// 确保侧边栏翻译按钮和样式被正确加载
function ensureSidebarTranslatorLoaded() {
  console.log('[内容脚本] 检查侧边栏翻译按钮是否已加载');
  
  // 立即插入内联样式，确保按钮样式立即可用
  const style = document.createElement('style');
  style.textContent = `
    .translator-sidebar-button {
      position: fixed;
      bottom: 100px;
      right: 20px;
      width: 50px;
      height: 50px;
      background-color: #2196F3;
      color: #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      z-index: 999999;
      user-select: none;
      transition: all 0.3s ease;
    }
    .translator-sidebar-button:hover {
      transform: scale(1.1);
      background-color: #0d8bf2;
    }
    .translator-sidebar-button.active {
      background-color: #4CAF50;
    }
    .translator-paragraph-translation {
      margin: 10px 0;
      padding: 12px 15px;
      background-color: #f8f9fa;
      border-left: 3px solid #2196F3;
      border-radius: 0 4px 4px 0;
      color: #333;
      position: relative;
      max-width: 100%;
    }
    .translator-paragraph-translation::before {
      content: "译文";
      position: absolute;
      top: -10px;
      left: 10px;
      background-color: #2196F3;
      color: white;
      padding: 0 8px;
      font-size: 12px;
      line-height: 20px;
      border-radius: 10px;
    }
  `;
  document.head.appendChild(style);
  
  // 立即创建按钮，不等待检查
  createSidebarButton();
  
  // 检查样式是否加载
  const styleExists = Array.from(document.styleSheets).some(sheet => {
    try {
      return sheet.href && sheet.href.includes('sidebar-button.css');
    } catch (e) {
      return false;
    }
  });
  
  if (!styleExists) {
    console.log('[内容脚本] 加载侧边栏翻译按钮外部样式');
    
    // 通过链接加载完整样式
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.runtime.getURL('styles/sidebar-button.css');
    document.head.appendChild(link);
  }
}

// 创建侧边栏按钮
function createSidebarButton() {
  console.log('[内容脚本] 创建侧边栏翻译按钮');
  
  // 检查按钮是否已存在
  if (document.querySelector('.translator-sidebar-button')) {
    console.log('[内容脚本] 按钮已存在，不重复创建');
    return;
  }
  
  // 创建按钮
  const button = document.createElement('div');
  button.className = 'translator-sidebar-button';
  button.textContent = '译';
  button.title = '点击开始全文翻译';
  
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
  
  // 添加点击事件 - 直接使用内联翻译函数
  button.addEventListener('click', () => {
    console.log('[内容脚本] 点击了侧边栏翻译按钮，直接调用翻译');
    
    try {
      // 直接在content.js中实现全文翻译功能
      const isActive = button.classList.contains('active');
      
      if (isActive) {
        // 停止翻译
        button.classList.remove('active');
        button.textContent = '译';
        button.title = '点击开始全文翻译';
        
        // 添加停止动画效果
        button.classList.add('stop-animation');
        setTimeout(() => button.classList.remove('stop-animation'), 500);
        
        // 移除滚动监听器
        window.removeEventListener('scroll', handleScroll);
        
        // 隐藏滚动翻译提示
        showScrollIndicator(false);
        
        console.log('[内容脚本] 停止全文翻译');
        // 移除所有翻译结果
        document.querySelectorAll('.translator-paragraph-translation').forEach(el => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
        // 移除加载指示器
        document.querySelectorAll('.translator-loading').forEach(el => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
        return;
      }
      
      // 开始翻译
      button.classList.add('active');
      button.textContent = '停';
      button.title = '点击停止全文翻译';
      
      // 添加启动动画效果
      button.classList.add('start-animation');
      setTimeout(() => button.classList.remove('start-animation'), 500);
      
      // 显示滚动翻译提示
      showScrollIndicator(true);
      
      console.log('[内容脚本] 开始翻译可见内容');
      
      // 首先翻译当前可见区域
      translateVisibleElements();
      
      // 添加滚动事件监听，翻译滚动后新出现的内容
      window.addEventListener('scroll', handleScroll);
      
    } catch (error) {
      console.error('[内容脚本] 处理侧边栏翻译按钮点击时出错:', error);
      alert('翻译功能出错: ' + error.message);
    }
  });
  
  console.log('[内容脚本] 侧边栏翻译按钮创建成功');
}

// 翻译文本函数
async function translateText(text) {
  console.log('[内容脚本] 调用翻译函数，文本长度:', text.length);
  
  return new Promise((resolve, reject) => {
    const messageId = `translate_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // 发送消息到后台脚本
    chrome.runtime.sendMessage({
      action: 'translate',
      text: text,
      messageId: messageId
    }, response => {
      // 检查错误
      if (chrome.runtime.lastError) {
        console.error('[内容脚本] 发送翻译请求时出错:', chrome.runtime.lastError);
        reject(new Error('与翻译服务通信失败: ' + chrome.runtime.lastError.message));
        return;
      }
      
      // 处理响应
      if (response && response.success) {
        console.log('[内容脚本] 收到翻译结果，长度:', response.translation.length);
        resolve(response.translation);
      } else {
        const errorMessage = (response && response.error) ? response.error : '未知错误';
        console.error('[内容脚本] 翻译响应错误:', errorMessage);
        reject(new Error(errorMessage));
      }
    });
  });
}

// 显示或隐藏滚动翻译状态指示器
function showScrollIndicator(show) {
  // 检查是否已存在
  let indicator = document.querySelector('.translator-scroll-indicator');
  
  if (!indicator && show) {
    // 创建指示器
    indicator = document.createElement('div');
    indicator.className = 'translator-scroll-indicator';
    indicator.textContent = '滚动时自动翻译';
    document.body.appendChild(indicator);
  }
  
  if (indicator) {
    if (show) {
      // 显示并在3秒后淡出
      indicator.classList.add('visible');
      setTimeout(() => {
        indicator.classList.remove('visible');
      }, 3000);
    } else {
      // 立即隐藏
      indicator.classList.remove('visible');
    }
  }
}

// 处理滚动事件 - 使用节流函数优化性能
let scrollTimer = null;
let scrollCount = 0;
function handleScroll() {
  if (scrollTimer) return;
  
  scrollTimer = setTimeout(() => {
    console.log('[内容脚本] 检测到页面滚动，翻译新的可见内容');
    translateVisibleElements();
    
    // 每隔3次滚动显示一次提示
    scrollCount++;
    if (scrollCount % 3 === 0) {
      showScrollIndicator(true);
    }
    
    scrollTimer = null;
  }, 300); // 300ms节流间隔
}

// 获取元素是否在视窗内可见
function isElementVisible(element) {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  
  // 元素顶部边缘在视窗内，或元素底部边缘在视窗内，或元素高度超过视窗但中间部分在视窗内
  return (
    (rect.top >= 0 && rect.top < windowHeight) ||
    (rect.bottom > 0 && rect.bottom <= windowHeight) ||
    (rect.top < 0 && rect.bottom > windowHeight)
  );
}

// 翻译当前可见的元素
function translateVisibleElements() {
  // 已翻译元素的集合 - 使用WeakSet避免内存泄漏
  const translatedElements = new WeakSet();
  
  // 获取所有可能需要翻译的元素
  const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th');
  console.log(`[内容脚本] 找到 ${paragraphs.length} 个可能的文本元素`);
  
  // 过滤出当前可见的、还未翻译的元素
  const visibleParagraphs = Array.from(paragraphs).filter(para => {
    // 跳过已有翻译的元素
    if (para.nextElementSibling && para.nextElementSibling.classList.contains('translator-paragraph-translation')) {
      return false;
    }
    
    // 跳过空内容
    const text = para.innerText || para.textContent;
    if (!text || text.trim().length < 10) {
      return false;
    }
    
    // 跳过代码块等不需要翻译的内容
    if (para.closest('pre, code, script, style')) {
      return false;
    }
    
    // 检查元素是否在当前视窗内可见
    return isElementVisible(para);
  });
  
  console.log(`[内容脚本] 找到 ${visibleParagraphs.length} 个需要翻译的可见元素`);
  
  // 批量处理翻译，避免一次性发送太多请求
  const BATCH_SIZE = 3; // 每批处理3个元素
  
  for (let i = 0; i < visibleParagraphs.length; i += BATCH_SIZE) {
    const batch = visibleParagraphs.slice(i, i + BATCH_SIZE);
    
    batch.forEach((paragraph, index) => {
      // 避免重复翻译
      if (translatedElements.has(paragraph)) return;
      translatedElements.add(paragraph);
      
      const text = paragraph.innerText || paragraph.textContent;
      
      // 延迟执行，错开请求时间
      setTimeout(() => {
        // 显示加载中指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'translator-loading';
        loadingIndicator.innerHTML = '<div class="translator-loading-spinner"></div>';
        
        // 添加到段落后面
        if (paragraph.nextSibling) {
          paragraph.parentNode.insertBefore(loadingIndicator, paragraph.nextSibling);
        } else {
          paragraph.parentNode.appendChild(loadingIndicator);
        }
        
        // 翻译文本
        translateText(text).then(translation => {
          // 移除加载指示器
          if (loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
          }
          
          // 显示翻译结果
          const translationElement = document.createElement('div');
          translationElement.className = 'translator-paragraph-translation';
          translationElement.textContent = translation;
          
          // 添加到段落后面
          if (paragraph.nextSibling) {
            paragraph.parentNode.insertBefore(translationElement, paragraph.nextSibling);
          } else {
            paragraph.parentNode.appendChild(translationElement);
          }
        }).catch(error => {
          console.error('[内容脚本] 翻译错误:', error);
          
          // 移除加载指示器
          if (loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
          }
          
          // 显示错误信息
          const errorElement = document.createElement('div');
          errorElement.className = 'translator-paragraph-translation translator-error';
          errorElement.textContent = `翻译失败: ${error.message || '未知错误'}`;
          
          // 添加到段落后面
          if (paragraph.nextSibling) {
            paragraph.parentNode.insertBefore(errorElement, paragraph.nextSibling);
          } else {
            paragraph.parentNode.appendChild(errorElement);
          }
        });
      }, index * 200); // 每200ms处理一个元素
    });
    
    // 批次间隔，避免API过载
    if (i + BATCH_SIZE < visibleParagraphs.length) {
      setTimeout(() => {}, BATCH_SIZE * 300);
    }
  }
}

// 无需等待DOM完全加载，立即执行
ensureSidebarTranslatorLoaded();

// 如果在执行到这里时body不存在，则等待body出现后再次尝试
if (!document.body) {
  console.log('[内容脚本] body元素不存在，等待body加载');
  
  // 使用MutationObserver监听DOM变化
  const observer = new MutationObserver(() => {
    if (document.body) {
      console.log('[内容脚本] 检测到body已加载，创建按钮');
      observer.disconnect();
      ensureSidebarTranslatorLoaded();
    }
  });
  
  observer.observe(document.documentElement, { childList: true, subtree: true });
  
  // 设置安全超时，确保即使MutationObserver没有触发也能创建按钮
  document.addEventListener('DOMContentLoaded', function() {
    observer.disconnect();
    ensureSidebarTranslatorLoaded();
  });
} else {
  // 为确保按钮始终存在，在DOM完全加载后再次检查
  document.addEventListener('DOMContentLoaded', function() {
    if (!document.querySelector('.translator-sidebar-button')) {
      console.log('[内容脚本] DOMContentLoaded后再次检查，创建按钮');
      createSidebarButton();
    }
  });
}

// 在页面完全加载后进行最后一次检查
window.addEventListener('load', function() {
  if (!document.querySelector('.translator-sidebar-button')) {
    console.log('[内容脚本] 页面完全加载后，再次确保按钮存在');
    createSidebarButton();
  }
});