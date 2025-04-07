// 翻译器模块 - 全局功能封装
// 使用IIFE并检查是否已存在
(function() {
  // 如果translatorModule已存在，不再重新创建
  if (window.translatorModule) {
    console.log('translatorModule已存在，不重新创建');
    return;
  }
  
  // 设置弹出框事件监听器
  function setupPopupEventListeners() {
    console.log('设置翻译弹出框事件监听器');
    
    // 关闭按钮点击事件
    document.addEventListener('click', function(event) {
      if (event.target.closest('.translator-popup-close')) {
        const popup = document.querySelector('.translator-popup');
        if (popup) popup.style.display = 'none';
      }
    });
    
    // 其他弹出框功能...
  }
  
  // 获取当前翻译器信息
  function getCurrentTranslator() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getTranslatorInfo" }, function(response) {
        if (response && response.success) {
          resolve({
            currentTranslator: response.currentTranslator,
            baiduAvailable: response.baiduAvailable,
            aliyunAvailable: response.aliyunAvailable
          });
        } else {
          resolve({
            currentTranslator: 'baidu',
            baiduAvailable: true,
            aliyunAvailable: false
          });
        }
      });
    });
  }
  
  // 切换翻译器
  function switchTranslator(translator) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ 
        action: "switchTranslator", 
        translator: translator 
      }, function(response) {
        resolve(response && response.success);
      });
    });
  }
  
  // 显示翻译器切换按钮
  function addTranslatorSwitchButton(popup) {
    getCurrentTranslator().then(info => {
      // 创建翻译器切换按钮
      const switcherContainer = document.createElement('div');
      switcherContainer.className = 'translator-switcher';
      switcherContainer.style.padding = '5px 10px';
      switcherContainer.style.borderTop = '1px solid #eee';
      switcherContainer.style.fontSize = '12px';
      switcherContainer.style.display = 'flex';
      switcherContainer.style.justifyContent = 'space-between';
      switcherContainer.style.alignItems = 'center';
      
      // 显示当前翻译器
      const currentLabel = document.createElement('span');
      currentLabel.textContent = `当前: ${info.currentTranslator === 'baidu' ? '百度翻译' : '阿里云翻译'}`;
      
      // 创建切换按钮
      const switchButton = document.createElement('button');
      switchButton.textContent = `切换到${info.currentTranslator === 'baidu' ? '阿里云' : '百度'}翻译`;
      switchButton.style.padding = '3px 8px';
      switchButton.style.backgroundColor = '#f0f0f0';
      switchButton.style.border = '1px solid #ddd';
      switchButton.style.borderRadius = '3px';
      switchButton.style.cursor = 'pointer';
      switchButton.style.fontSize = '12px';
      
      // 添加切换事件
      switchButton.addEventListener('click', async () => {
        const newTranslator = info.currentTranslator === 'baidu' ? 'aliyun' : 'baidu';
        const success = await switchTranslator(newTranslator);
        
        if (success) {
          // 更新按钮文本
          currentLabel.textContent = `当前: ${newTranslator === 'baidu' ? '百度翻译' : '阿里云翻译'}`;
          switchButton.textContent = `切换到${newTranslator === 'baidu' ? '阿里云' : '百度'}翻译`;
          
          // 显示切换成功通知
          showTranslatorSwitchNotification(newTranslator);
        }
      });
      
      // 添加到容器
      switcherContainer.appendChild(currentLabel);
      switcherContainer.appendChild(switchButton);
      
      // 添加到弹出框
      popup.appendChild(switcherContainer);
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
  
  // 显示翻译弹出框
  function showTranslationPopup(originalText, translationText, position) {
    console.log('显示翻译弹出框');
    
    // 检查是否已存在弹出框
    let popup = document.getElementById('translator-popup');
    
    // 如果不存在，创建一个新的
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'translator-popup';
      popup.className = 'translator-popup';
      popup.style.position = 'absolute';
      popup.style.zIndex = '10000';
      popup.style.backgroundColor = 'white';
      popup.style.border = '1px solid #ccc';
      popup.style.borderRadius = '5px';
      popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      popup.style.maxWidth = '400px';
      popup.style.maxHeight = '300px';
      popup.style.overflow = 'auto';
      popup.style.fontSize = '14px';
      popup.style.lineHeight = '1.4';
      
      // 创建内部结构
      popup.innerHTML = `
        <div style="position: absolute; top: 5px; right: 5px; cursor: pointer; font-size: 16px; color: #666;">×</div>
        <div class="translator-popup-content">
          <div class="translator-popup-original" style="padding: 10px; border-bottom: 1px solid #eee; color: #666; font-size: 12px;"></div>
          <div class="translator-popup-translation" style="padding: 10px;"></div>
        </div>
      `;
      
      // 添加关闭按钮事件
      const closeBtn = popup.querySelector('div[style*="position: absolute"]');
      closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
      });
      
      // 添加到页面
      document.body.appendChild(popup);
    }
    
    // 设置位置
    popup.style.left = `${position.x}px`;
    popup.style.top = `${position.y}px`;
    popup.style.display = 'block';
    
    // 设置内容 - 不截断翻译结果
    popup.querySelector('.translator-popup-original').textContent = originalText;
    
    // 更新翻译结果
    const popupContent = document.createElement('div');
    popupContent.id = 'translation-content';
    popupContent.style.padding = '10px';
    popupContent.style.whiteSpace = 'pre-line'; // 保留换行符
    popupContent.innerHTML = translationText; // 使用innerHTML以支持HTML标签如<br>
    
    const translationContainer = popup.querySelector('.translator-popup-translation');
    translationContainer.innerHTML = ''; // 清空之前的内容
    translationContainer.appendChild(popupContent);
    
    // 添加翻译器切换按钮
    addTranslatorSwitchButton(popup);
    
    // 确保弹出框在视口内
    const rect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (rect.right > viewportWidth) {
      popup.style.left = `${viewportWidth - rect.width - 10}px`;
    }
    
    if (rect.bottom > viewportHeight) {
      popup.style.top = `${viewportHeight - rect.height - 10}px`;
    }
    
    return popup;
  }
  
  // 获取选中文本及其DOM边界
  function getSelectedTextWithDomBoundaries() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return { text: '', domBoundaries: [] };
    }
    
    const text = selection.toString();
    const domBoundaries = [];
    
    // 如果选择跨越多个节点，找出边界位置
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // 获取所有包含在选择范围内的文本节点
      const nodes = [];
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        { acceptNode: node => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
      );
      
      let node;
      while (node = walker.nextNode()) {
        nodes.push(node);
      }
      
      // 如果有多个节点，计算每个节点边界在选中文本中的位置
      if (nodes.length > 1) {
        let currentPosition = 0;
        
        for (let i = 0; i < nodes.length - 1; i++) {
          const nodeText = nodes[i].textContent;
          const nodeInRange = nodeText.substring(
            i === 0 ? range.startOffset : 0,
            i === nodes.length - 1 ? range.endOffset : nodeText.length
          );
          
          currentPosition += nodeInRange.length;
          domBoundaries.push(currentPosition);
        }
      }
    }
    
    return { text, domBoundaries };
  }
  
  // 翻译选中文本
  async function translateSelectedText() {
    // 获取选中文本和DOM边界
    const { text, domBoundaries } = getSelectedTextWithDomBoundaries();
    
    if (!text) {
      console.log('没有选中文本');
      return;
    }
    
    try {
      console.log('翻译选中文本:', text);
      console.log('DOM边界:', domBoundaries);
      
      // 获取选择位置
      const range = window.getSelection().getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const position = {
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 10
      };
      
      // 显示加载状态
      showTranslationPopup(text, '正在翻译...', position);
      
      // 发送翻译请求
      chrome.runtime.sendMessage(
        { 
          action: "translateSelection", 
          text: text,
          domBoundaries: domBoundaries
        },
        function(response) {
          if (response && response.success) {
            // 更新翻译结果
            console.log('收到翻译结果:', response.translation);
            showTranslationPopup(text, response.translation, position);
          } else {
            // 处理错误
            const errorMsg = response ? response.error : '翻译请求失败';
            
            // 检查是否是额度不足错误
            if (errorMsg.includes('54003') || errorMsg.includes('额度') || 
                errorMsg.includes('limit') || errorMsg.includes('超出')) {
              
              // 显示错误并提供切换翻译器选项
              getCurrentTranslator().then(info => {
                const errorHtml = `
                  <div style="color: red; margin-bottom: 10px;">错误: ${errorMsg}</div>
                  <div>
                    <button id="switch-translator-btn" style="padding: 5px 10px; background-color: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">
                      切换到${info.currentTranslator === 'baidu' ? '阿里云' : '百度'}翻译
                    </button>
                  </div>
                `;
                
                showTranslationPopup(text, errorHtml, position);
                
                // 添加切换按钮事件
                const switchBtn = document.getElementById('switch-translator-btn');
                if (switchBtn) {
                  switchBtn.addEventListener('click', async () => {
                    const newTranslator = info.currentTranslator === 'baidu' ? 'aliyun' : 'baidu';
                    const success = await switchTranslator(newTranslator);
                    
                    if (success) {
                      // 显示切换成功通知
                      showTranslatorSwitchNotification(newTranslator);
                      
                      // 重新尝试翻译
                      setTimeout(() => {
                        translateSelectedText();
                      }, 500);
                    }
                  });
                }
              });
            } else {
              // 显示普通错误
              showTranslationPopup(text, `<div style="color: red;">错误: ${errorMsg}</div>`, position);
            }
          }
        }
      );
    } catch (error) {
      console.error('翻译选中文本失败:', error);
      showTranslationPopup(text, `<div style="color: red;">错误: ${error.message}</div>`, {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
    }
  }
  
  // 初始化
  function initialize() {
    console.log('初始化翻译模块');
    
    // 确保API凭据已加载
    ensureApiCredentials();
    
    // 添加快捷键监听
    document.addEventListener('keydown', handleKeyDown);
    
    // 添加右键菜单监听
    document.addEventListener('contextmenu', handleContextMenu);
    
    console.log('翻译模块初始化完成');
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
  
  // 导出到全局
  window.translatorModule = {
    setupPopupEventListeners,
    showTranslationPopup,
    translateSelectedText
  };
  
  console.log('翻译模块已加载，可用方法:', Object.keys(window.translatorModule).join(', '));
})(); 