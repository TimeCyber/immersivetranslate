// 添加调试日志函数
function log(message, data) {
  console.log(`[Popup] ${message}`, data !== undefined ? data : '');
}

// 默认设置
const DEFAULT_SETTINGS = {
  translationMode: 'light',
  translationEngine: 'ollama', // 默认使用Ollama
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: ''
};

// 全局变量
let availableModels = [];

// 初始化UI
function initUI() {
  // 加载保存的设置
  chrome.storage.local.get([
    'translationMode', 
    'translationEngine',
    'ollamaEndpoint',
    'ollamaModel',
    'availableModels'
  ], function(result) {
    // 设置翻译模式
    if (result.translationMode) {
      document.getElementById('translation-mode').value = result.translationMode;
    } else {
      document.getElementById('translation-mode').value = DEFAULT_SETTINGS.translationMode;
    }
    
    // 设置翻译引擎
    if (result.translationEngine) {
      document.getElementById('translation-engine').value = result.translationEngine;
    } else {
      document.getElementById('translation-engine').value = DEFAULT_SETTINGS.translationEngine;
    }
    
    // 设置Ollama配置
    if (result.ollamaEndpoint) {
      document.getElementById('ollama-endpoint').value = result.ollamaEndpoint;
    } else {
      document.getElementById('ollama-endpoint').value = DEFAULT_SETTINGS.ollamaEndpoint;
    }
    
    // 尝试加载之前保存的模型列表
    if (result.availableModels && Array.isArray(result.availableModels) && result.availableModels.length > 0) {
      availableModels = result.availableModels;
      populateModelSelector(availableModels, result.ollamaModel);
    } else {
      // 如果没有保存的模型列表，尝试加载
      fetchOllamaModels(result.ollamaEndpoint || DEFAULT_SETTINGS.ollamaEndpoint)
        .then(models => {
          if (models && models.length > 0) {
            populateModelSelector(models, result.ollamaModel);
          }
        });
    }
    
    // 根据选择的翻译引擎显示/隐藏Ollama设置
    toggleOllamaSettings(result.translationEngine || DEFAULT_SETTINGS.translationEngine);
  });
  
  // 添加翻译引擎切换事件
  document.getElementById('translation-engine').addEventListener('change', function(e) {
    toggleOllamaSettings(e.target.value);
  });
  
  // 添加测试Ollama连接按钮事件
  document.getElementById('test-ollama').addEventListener('click', testOllamaConnection);
  
  // 添加刷新模型列表按钮事件
  document.getElementById('refresh-models').addEventListener('click', function() {
    refreshModelsList();
  });
}

// 显示/隐藏Ollama设置
function toggleOllamaSettings(engine) {
  const ollamaSettings = document.getElementById('ollama-settings');
  ollamaSettings.style.display = engine === 'ollama' ? 'block' : 'none';
}

// 获取Ollama模型列表
async function fetchOllamaModels(endpoint) {
  const loadingIndicator = document.getElementById('models-loading');
  const refreshButton = document.getElementById('refresh-models');
  
  try {
    loadingIndicator.style.display = 'flex';
    refreshButton.disabled = true;
    
    log(`从 ${endpoint} 获取Ollama模型列表`);
    const response = await fetch(`${endpoint}/api/tags`);
    
    if (!response.ok) {
      throw new Error(`获取模型列表失败: ${response.status}`);
    }
    
    const data = await response.json();
    log('获取到的Ollama模型数据:', data);
    
    if (data && data.models && Array.isArray(data.models)) {
      // 提取模型名称
      availableModels = data.models.map(model => {
        return typeof model === 'string' ? model : model.name;
      }).filter(Boolean);
      
      log(`获取到${availableModels.length}个Ollama模型:`, availableModels);
      
      // 保存模型列表到存储
      chrome.storage.local.set({ 'availableModels': availableModels });
      
      return availableModels;
    } else {
      log('模型数据格式不正确:', data);
      showMessage('模型列表格式不正确', true);
      return [];
    }
  } catch (error) {
    log('获取Ollama模型列表出错:', error);
    showMessage(`获取模型列表失败: ${error.message}`, true);
    return [];
  } finally {
    loadingIndicator.style.display = 'none';
    refreshButton.disabled = false;
  }
}

// 刷新模型列表
async function refreshModelsList() {
  const endpoint = document.getElementById('ollama-endpoint').value.trim();
  const refreshButton = document.getElementById('refresh-models');
  const originalText = refreshButton.textContent;
  
  try {
    updateButtonUI(refreshButton, 'loading', '', '加载中...');
    const models = await fetchOllamaModels(endpoint);
    
    if (models && models.length > 0) {
      populateModelSelector(models);
      updateButtonUI(refreshButton, 'success', '', '✓ 已刷新');
      showMessage(`成功加载了 ${models.length} 个模型`);
    } else {
      updateButtonUI(refreshButton, 'normal', originalText);
      showMessage('没有找到可用的模型', true);
    }
  } catch (error) {
    log('刷新模型列表失败:', error);
    updateButtonUI(refreshButton, 'normal', originalText);
    showMessage(`刷新模型列表失败: ${error.message}`, true);
  } finally {
    setTimeout(() => {
      updateButtonUI(refreshButton, 'normal', originalText);
    }, 2000);
  }
}

// 填充模型选择器
function populateModelSelector(models, selectedModel = '') {
  const modelSelector = document.getElementById('ollama-model');
  
  // 清空当前选项（保留第一个禁用的选项）
  while (modelSelector.options.length > 1) {
    modelSelector.remove(1);
  }
  
  // 添加模型选项
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    modelSelector.appendChild(option);
  });
  
  // 设置选中的模型
  if (selectedModel && models.includes(selectedModel)) {
    modelSelector.value = selectedModel;
  } else if (models.length > 0) {
    // 如果没有指定模型或指定的模型不在列表中，选择第一个
    modelSelector.value = models[0];
  }
}

// 测试Ollama连接
async function testOllamaConnection() {
  const endpoint = document.getElementById('ollama-endpoint').value.trim();
  const modelSelector = document.getElementById('ollama-model');
  const model = modelSelector.value;
  const testButton = document.getElementById('test-ollama');
  const originalText = testButton.textContent;
  
  // 检查是否选择了模型
  if (!model) {
    showMessage('请先选择一个模型', true);
    return;
  }
  
  try {
    updateButtonUI(testButton, 'loading', '', '测试中...');
    
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: '你好',
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`连接失败: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.response) {
      updateButtonUI(testButton, 'success', '', '✓ 测试成功');
      showMessage(`Ollama连接测试成功! 模型响应: "${data.response.substring(0, 20)}..."`);
    } else {
      throw new Error('无效的响应');
    }
  } catch (error) {
    log('Ollama连接测试失败:', error);
    updateButtonUI(testButton, 'normal', originalText);
    showMessage('Ollama连接测试失败: ' + error.message, true);
  } finally {
    setTimeout(() => {
      updateButtonUI(testButton, 'normal', originalText);
    }, 2000);
  }
}

// 添加CSS样式以支持动画
function addAnimationStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .button-animation {
      animation: pulse 0.3s ease-in-out;
    }
    
    .button-success {
      background-color: #34a853 !important;
      transition: background-color 0.3s ease;
    }
    
    .button-icon {
      display: inline-block;
      margin-right: 5px;
      transition: transform 0.3s ease;
    }
    
    .button-text {
      display: inline-block;
    }
    
    .button-loading {
      position: relative;
      pointer-events: none;
    }
    
    .button-loading::after {
      content: "";
      position: absolute;
      width: 16px;
      height: 16px;
      top: calc(50% - 8px);
      left: calc(50% - 8px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// 显示消息
function showMessage(message, isError = false) {
  const messageEl = document.getElementById('message');
  messageEl.textContent = message;
  messageEl.className = `message ${isError ? 'message-error' : 'message-success'}`;
  
  // 触发动画
  setTimeout(() => {
    messageEl.classList.add('show');
  }, 10);
  
  // 自动隐藏
  setTimeout(() => {
    messageEl.classList.remove('show');
    
    // 等待动画完成后重置
    setTimeout(() => {
      messageEl.className = 'message';
    }, 300);
  }, 3000);
}

// 创建按钮点击涟漪效果
function createRippleEffect(event) {
  const button = event.currentTarget;
  
  // 创建涟漪元素
  const ripple = document.createElement('span');
  ripple.classList.add('button-ripple');
  
  // 计算涟漪位置
  const rect = button.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // 设置涟漪样式
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  
  // 添加到按钮
  button.appendChild(ripple);
  
  // 动画结束后移除
  setTimeout(() => {
    ripple.remove();
  }, 600);
}

// 更新按钮UI
function updateButtonUI(button, state, originalIcon = '', loadingText = '处理中...', successText = '✓ 成功') {
  const buttonText = button.querySelector('.button-text') || button;
  
  // 移除所有状态类
  button.classList.remove('button-loading', 'button-success', 'button-animation');
  
  switch(state) {
    case 'loading':
      button.classList.add('button-loading');
      buttonText.textContent = loadingText;
      button.disabled = true;
      break;
    case 'success':
      button.classList.add('button-success', 'button-animation');
      buttonText.textContent = successText;
      button.disabled = true;
      break;
    case 'reset-success':
      button.classList.add('button-success', 'button-animation');
      buttonText.textContent = '✓ 已重置';
      button.disabled = true;
      showMessage('设置已恢复默认');
      break;
    case 'normal':
      buttonText.textContent = originalText;
      button.disabled = false;
      break;
  }
}

// 保存设置
function saveSettings(event) {
  const saveButton = document.getElementById('save-settings');
  const originalText = saveButton.textContent;
  createRippleEffect(event);
  
  // 获取设置值
  const translationMode = document.getElementById('translation-mode').value;
  const translationEngine = document.getElementById('translation-engine').value;
  const ollamaEndpoint = document.getElementById('ollama-endpoint').value.trim();
  const ollamaModel = document.getElementById('ollama-model').value;
  
  // 验证输入
  if (translationEngine === 'ollama') {
    if (!ollamaEndpoint) {
      showMessage('请输入Ollama API地址', true);
      return;
    }
    
    if (!ollamaModel) {
      showMessage('请选择一个Ollama模型', true);
      return;
    }
  }
  
  // 更新按钮UI
  updateButtonUI(saveButton, 'loading', '', '保存中...');
  
  // 准备要保存的设置
  const settings = {
    translationMode,
    translationEngine,
    ollamaEndpoint,
    ollamaModel,
    availableModels
  };
  
  // 保存设置
  chrome.storage.local.set(settings, function() {
    if (chrome.runtime.lastError) {
      log('保存设置出错:', chrome.runtime.lastError);
      updateButtonUI(saveButton, 'normal', originalText);
      showMessage('保存设置失败: ' + chrome.runtime.lastError.message, true);
      return;
    }
    
    // 通知后台脚本设置已更新
    chrome.runtime.sendMessage({ action: 'settingsUpdated', settings }, function(response) {
      log('设置更新通知发送成功，响应:', response);
    });
    
    // 更新UI
    updateButtonUI(saveButton, 'success', '', '✓ 已保存');
    
    // 恢复按钮
    setTimeout(() => {
      updateButtonUI(saveButton, 'normal', originalText);
    }, 2000);
  });
}

// 重置设置
function resetSettings(event) {
  const resetButton = document.getElementById('reset-settings');
  const originalText = resetButton.textContent;
  createRippleEffect(event);
  
  // 更新按钮UI
  updateButtonUI(resetButton, 'loading', '', '重置中...');
  
  // 尝试获取最新的模型列表
  fetchOllamaModels(DEFAULT_SETTINGS.ollamaEndpoint)
    .then(models => {
      if (models && models.length > 0) {
        DEFAULT_SETTINGS.ollamaModel = models[0];
        availableModels = models;
      }
      
      // 保存默认设置
      chrome.storage.local.set(DEFAULT_SETTINGS, function() {
        if (chrome.runtime.lastError) {
          log('重置设置出错:', chrome.runtime.lastError);
          updateButtonUI(resetButton, 'normal', originalText);
          showMessage('重置设置失败: ' + chrome.runtime.lastError.message, true);
          return;
        }
        
        // 通知后台脚本设置已更新
        chrome.runtime.sendMessage({ action: 'settingsUpdated', settings: DEFAULT_SETTINGS }, function(response) {
          log('设置更新通知发送成功，响应:', response);
        });
        
        // 更新UI
        document.getElementById('translation-mode').value = DEFAULT_SETTINGS.translationMode;
        document.getElementById('translation-engine').value = DEFAULT_SETTINGS.translationEngine;
        document.getElementById('ollama-endpoint').value = DEFAULT_SETTINGS.ollamaEndpoint;
        
        // 更新模型选择器
        populateModelSelector(availableModels, DEFAULT_SETTINGS.ollamaModel);
        
        // 显示/隐藏相关设置
        toggleOllamaSettings(DEFAULT_SETTINGS.translationEngine);
        
        updateButtonUI(resetButton, 'reset-success');
        
        // 恢复按钮
        setTimeout(() => {
          updateButtonUI(resetButton, 'normal', originalText);
        }, 2000);
      });
    })
    .catch(error => {
      log('重置时获取模型列表失败:', error);
      
      // 即使获取模型失败，也继续重置其他设置
      chrome.storage.local.set(DEFAULT_SETTINGS, function() {
        document.getElementById('translation-mode').value = DEFAULT_SETTINGS.translationMode;
        document.getElementById('translation-engine').value = DEFAULT_SETTINGS.translationEngine;
        document.getElementById('ollama-endpoint').value = DEFAULT_SETTINGS.ollamaEndpoint;
        
        toggleOllamaSettings(DEFAULT_SETTINGS.translationEngine);
        
        updateButtonUI(resetButton, 'reset-success');
        
        setTimeout(() => {
          updateButtonUI(resetButton, 'normal', originalText);
        }, 2000);
      });
    });
}

// 准备按钮UI
function prepareButtonsUI() {
  // 添加保存按钮事件
  const saveButton = document.getElementById('save-settings');
  saveButton.addEventListener('click', saveSettings);
  
  // 添加重置按钮事件
  const resetButton = document.getElementById('reset-settings');
  resetButton.addEventListener('click', resetSettings);
  
  // 为所有按钮添加涟漪效果
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.addEventListener('click', createRippleEffect);
  });
}

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
  addAnimationStyles();
  initUI();
  prepareButtonsUI();
}); 