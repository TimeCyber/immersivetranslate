// 翻译助手 - 后台脚本
// 处理翻译请求和其他后台操作

// 继续使用importScripts
try {
  importScripts('../scripts/crypto-js.min.js');
  console.log('成功导入CryptoJS库');
} catch (e) {
  console.error('导入CryptoJS库失败:', e);
}

// 内联CryptoUtil实现
const CryptoUtil = (() => {
  // 加密密钥 - 与加密时使用的相同
  const ENCRYPTION_KEY = 'BaiduTranslatorSecretKey7X91A'; // 确保这个密钥与加密时使用的相同
  
  // XOR加密/解密函数 (同一个函数可用于加密和解密)
  function xorEncryptDecrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  }
  
  // 将字符串转换为Base64
  function toBase64(text) {
    return btoa(text);
  }
  
  // 从Base64解码为字符串
  function fromBase64(base64) {
    try {
      // 移除等号前缀(如果有)
      const cleanBase64 = base64.startsWith('=') ? base64.substring(1) : base64;
      return atob(cleanBase64);
    } catch (e) {
      console.error('Base64解码失败:', e, base64);
      return '';
    }
  }
  
  // 混淆函数
  function obfuscate(text) {
    return text.split('').reverse().join('');
  }
  
  // 反混淆函数
  function deobfuscate(text) {
    return text.split('').reverse().join('');
  }
  
  // 加密函数
  function encrypt(text) {
    if (!text) return '';
    const xorText = xorEncryptDecrypt(text, ENCRYPTION_KEY);
    return obfuscate(toBase64(xorText));
  }
  
  // 解密函数
  function decrypt(encryptedText) {
    if (!encryptedText) return '';
    
    try {
      // 1. 移除前缀"="（如果有）
      if (encryptedText.startsWith('=')) {
        encryptedText = encryptedText.substring(1);
      }
      
      // 2. 反转字符串（解混淆）
      const obfuscatedText = encryptedText.split('').reverse().join('');
      
      // 3. Base64解码
      const decodedText = atob(obfuscatedText);
      
      // 4. XOR解密
      return xorDecrypt(decodedText, ENCRYPTION_KEY);
    } catch (e) {
      console.error('解密失败:', e);
      return '';
    }
  }
  
  // XOR解密（与加密相同）
  function xorDecrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  }
  
  return {
    encrypt,
    decrypt,
    obfuscate,
    deobfuscate
  };
})();

// 确保在Service Worker环境中可用
self.CryptoUtil = CryptoUtil;

// MD5函数实现 - 确保在Service Worker中可用
function MD5(string) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  
  function addUnsigned(lX, lY) {
    const lX8 = (lX & 0x80000000);
    const lY8 = (lY & 0x80000000);
    const lX4 = (lX & 0x40000000);
    const lY4 = (lY & 0x40000000);
    const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
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
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  
  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  
  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  
  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  
  function convertToWordArray(string) {
    let lWordCount;
    const lMessageLength = string.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  
  function wordToHex(lValue) {
    let WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      WordToHexValue_temp = "0" + lByte.toString(16);
      WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
    }
    return WordToHexValue;
  }
  
  let x = [];
  let k, AA, BB, CC, DD, a, b, c, d;
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  
  string = utf8Encode(string);
  x = convertToWordArray(string);
  a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
  
  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d;
    a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
    b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
    a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
    c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
    c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
    a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
    a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
    d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
    a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
    a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
    a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
    c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
    a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
    c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
    b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
    c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
    d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
    c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
    a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
    d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
    b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  
  const temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
  return temp.toLowerCase();
}

// UTF8编码函数
function utf8Encode(string) {
  string = string.replace(/\r\n/g, "\n");
  let utftext = "";
  
  for (let n = 0; n < string.length; n++) {
    const c = string.charCodeAt(n);
    
    if (c < 128) {
      utftext += String.fromCharCode(c);
    } else if ((c > 127) && (c < 2048)) {
      utftext += String.fromCharCode((c >> 6) | 192);
      utftext += String.fromCharCode((c & 63) | 128);
    } else {
      utftext += String.fromCharCode((c >> 12) | 224);
      utftext += String.fromCharCode(((c >> 6) & 63) | 128);
      utftext += String.fromCharCode((c & 63) | 128);
    }
  }
  
  return utftext;
}

// 调试日志函数
function log(message, data) {
  console.log(`[Background] ${message}`, data !== undefined ? data : '');
}

// 全局变量
let currentTranslator = 'ollama'; // 默认使本地大模型翻译
let translationCache = {}; // 翻译缓存

// 百度翻译API凭据 - 使用从配置文件导入的凭据
const BAIDU_CREDENTIALS = {
  APPID: '', // 示例ID，请替换为实际ID
  SECRET: '' // 示例密钥，请替换为实际密钥
};

// 阿里云翻译API凭据 - 使用从配置文件导入的凭据
const ALIYUN_CREDENTIALS =  {
  ACCESS_KEY_ID: '', // 示例ID，请替换为实际ID
  ACCESS_KEY_SECRET: '' // 示例密钥，请替换为实际密钥
};

// Ollama翻译功能
async function ollamaTranslate(text, from = 'auto', to = 'zh') {
  try {
    console.log('🚀 [Ollama翻译] 开始翻译', {
      原文预览: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    });
    
    // 获取Ollama设置
    const { ollamaEndpoint, ollamaModel } = await new Promise((resolve) => {
      chrome.storage.local.get(['ollamaEndpoint', 'ollamaModel'], resolve);
    });
    
    console.log('📝 [Ollama翻译] 使用配置:', { 
      endpoint: ollamaEndpoint || 'http://localhost:11434',
      model: ollamaModel || '未指定模型'
    });
    
    // 检查必要参数
    if (!ollamaEndpoint) {
      throw new Error('未设置Ollama API地址');
    }
    
    if (!ollamaModel) {
      throw new Error('未指定Ollama模型');
    }
    
    // 构建请求体
    let prompt;
    if (to === 'zh' || to === 'zh-CN' || to === 'zh-Hans') {
      // 翻译为中文
      prompt = `请将以下${from !== 'auto' && from !== 'zh' ? from + '语言的' : ''}文本翻译成中文，只返回翻译结果，不要包含原文，不要有任何前缀说明:\n\n${text}`;
    } else if (to === 'en') {
      // 翻译为英文
      prompt = `Please translate the following ${from !== 'auto' && from !== 'en' ? from + ' ' : ''}text to English. Only return the translation result without including the original text or any prefixes:\n\n${text}`;
    } else {
      // 翻译为其他语言
      prompt = `Please translate the following text to ${to} language. Only return the translation result without including the original text or any prefixes:\n\n${text}`;
    }
    
    // 创建可取消的请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    try {
      console.log(`📤 [Ollama翻译] 发送请求到 ${ollamaEndpoint}/api/generate，模型: ${ollamaModel}`);
      
      // 发送请求到Ollama API
      const response = await fetch(`${ollamaEndpoint}/api/generate`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: prompt,
          stream: false
        })
      });
      
      // 清除超时
      clearTimeout(timeoutId);
      
      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Ollama翻译] 响应错误:', { 
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        // 判断错误类型
        if (response.status === 404) {
          throw new Error(`Ollama模型 "${ollamaModel}" 不存在，请确认模型名称或拉取模型`);
        } else if (response.status === 500) {
          throw new Error(`Ollama服务器错误: ${errorText}`);
        } else if (response.status === 400) {
          throw new Error(`请求格式错误: ${errorText}`);
        } else {
          throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
        }
      }
      
      // 处理响应
      const data = await response.json();
      console.log('📥 [Ollama翻译] 收到响应:', data);
      
      if (data.response) {
        // 清理响应文本
        let translation = data.response.trim();
        
        // 移除常见的前缀
        const prefixesToRemove = [
          '翻译结果：', '翻译:', '翻译：', '译文：', '译文:', 
          'Translation:', 'Translated text:', 'Result:',
          '以下是翻译：', '以下是中文翻译：'
        ];
        
        for (const prefix of prefixesToRemove) {
          if (translation.startsWith(prefix)) {
            translation = translation.substring(prefix.length).trim();
            break;
          }
        }
        
        console.log('✅ [Ollama翻译] 翻译成功', {
          原文预览: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          译文预览: translation.substring(0, 50) + (translation.length > 50 ? '...' : '')
        });
        
        return translation;
      } else {
        throw new Error('Ollama API返回的响应中没有翻译结果');
      }
    } catch (fetchError) {
      // 清除超时
      clearTimeout(timeoutId);
      
      // 处理不同类型的错误
      if (fetchError.name === 'AbortError') {
        throw new Error('Ollama翻译请求超时，请检查模型是否正在运行');
      } else if (fetchError.message.includes('Failed to fetch') || 
                fetchError.message.includes('Network request failed')) {
        throw new Error('无法连接到Ollama服务，请确保Ollama正在运行并且API地址正确');
      } else {
        throw fetchError;
      }
    }
  } catch (error) {
    console.error('❌ [Ollama翻译] 翻译过程中出错:', error);
    throw error;
  }
}

// 初始化函数
function initialize() {
  log('初始化后台脚本...');
  
  // 加载保存的设置
  return new Promise((resolve) => {
    chrome.storage.local.get(['preferred_translator', 'translationEngine'], function(result) {
      if (chrome.runtime.lastError) {
        log('加载设置时出错:', chrome.runtime.lastError);
        resolve();
        return;
      }

      // 优先使用translationEngine，然后是preferred_translator
      if (result.translationEngine) {
        currentTranslator = result.translationEngine;
        log('使用translationEngine设置:', currentTranslator);
      } else if (result.preferred_translator) {
        currentTranslator = result.preferred_translator;
        log('使用preferred_translator设置:', currentTranslator);
        // 同步到translationEngine
        chrome.storage.local.set({ 'translationEngine': currentTranslator });
      } else {
        // 保存默认设置到两个键
        chrome.storage.local.set({ 
          'preferred_translator': currentTranslator,
          'translationEngine': currentTranslator
        });
        log('保存默认翻译器设置:', currentTranslator);
      }
      
      resolve();
    });
  });
}

// 百度翻译API实现
async function baiduTranslate(text, from = 'auto', to = 'zh') {
  try {
    console.log('🔄 [百度翻译] 开始翻译...', {
      文本长度: text.length,
      原文预览: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      源语言: from,
      目标语言: to
    });

    const salt = Date.now().toString();
    const appid = BAIDU_CREDENTIALS.APPID;//CryptoUtil.decrypt(BAIDU_CREDENTIALS.APPID)
    const key = BAIDU_CREDENTIALS.SECRET;//CryptoUtil.decrypt(BAIDU_CREDENTIALS.SECRET)
    
    // 检查API凭据
    if (!appid || appid.trim() === '' || !key || key.trim() === '') {
      throw new Error('百度翻译API凭据无效或未配置');
    }
    
    const sign = MD5(appid + text + salt + key);
    
    const url = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
    const params = new URLSearchParams({
      q: text,
      from: from,
      to: to,
      appid: appid,
      salt: salt,
      sign: sign
    });
    
    log('发送百度翻译请求:', { text: text.substring(0, 30) + (text.length > 30 ? '...' : ''), from, to });
    
    // 创建AbortController用于请求超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    try {
      // 使用fetch API带超时控制
      const response = await fetch(`${url}?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // 清除超时计时器
      clearTimeout(timeoutId);
      
      // 检查响应状态
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error_code) {
        console.error('❌ [百度翻译] 翻译失败:', data.error_msg);
        throw new Error(`百度翻译错误: ${data.error_code} - ${data.error_msg}`);
      }
      
      if (data.trans_result && data.trans_result.length > 0) {
        const translations = data.trans_result.map(item => item.dst);
        console.log('✅ [百度翻译] 翻译成功', {
          原文预览: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          译文预览: translations[0].substring(0, 50) + (translations[0].length > 50 ? '...' : '')
        });
        return translations.join('\n');
      } else {
        throw new Error('百度翻译返回结果格式错误');
      }
    } catch (fetchError) {
      // 清除超时计时器，以防它尚未触发
      clearTimeout(timeoutId);
      
      // 处理不同类型的网络错误
      if (fetchError.name === 'AbortError') {
        throw new Error('百度翻译API请求超时');
      } else if (fetchError.message.includes('Failed to fetch') || 
                 fetchError.message.includes('Network request failed')) {
        throw new Error('网络连接失败，无法连接到百度翻译API');
      } else {
        throw fetchError; // 重新抛出其他错误ba
      }
    }
  } catch (error) {
    console.error('❌ [百度翻译] 发生错误:', error.message);
    throw error;
  }
}

// 阿里云翻译API实现 - 权限错误处理增强
async function aliyunTranslate(text, from = 'auto', to = 'zh') {
  try {
    console.log('🔄 [阿里云翻译] 开始翻译...', {
      文本长度: text.length,
      原文预览: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      源语言: from,
      目标语言: to
    });

    const accessKeyId = ALIYUN_CREDENTIALS.ACCESS_KEY_ID;//CryptoUtil.decrypt(ALIYUN_CREDENTIALS.ACCESS_KEY_ID)
    const accessKeySecret = ALIYUN_CREDENTIALS.ACCESS_KEY_SECRET;//CryptoUtil.decrypt(ALIYUN_CREDENTIALS.ACCESS_KEY_SECRET)
    
    // 检查API凭据
    if (!accessKeyId || accessKeyId.trim() === '' || !accessKeySecret || accessKeySecret.trim() === '') {
      throw new Error('阿里云翻译API凭据无效或未配置');
    }
    
    // 使用阿里云推荐的通用翻译API端点
    const endpoint = 'mt.cn-hangzhou.aliyuncs.com';
    const apiUrl = `https://${endpoint}`;
    
    // 请求参数
    const date = new Date();
    const timestamp = date.toISOString();
    const requestId = Math.random().toString(36).substring(2, 15);
    
    // 通用参数 - 使用更简单的电商翻译API
    const commonParams = {
      Format: 'JSON',
      Version: '2018-10-12',
      AccessKeyId: accessKeyId,
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: timestamp,
      SignatureVersion: '1.0',
      SignatureNonce: requestId,
      Action: 'TranslateECommerce',  // 尝试使用电商翻译API，需要相应权限
    };
    
    // 业务参数
    const businessParams = {
      FormatType: 'text',
      SourceLanguage: from === 'auto' ? 'auto' : from,
      TargetLanguage: to,
      SourceText: text,
      Scene: 'general',
    };
    
    // 合并所有参数
    const allParams = { ...commonParams, ...businessParams };
    
    // 创建规范化的查询字符串
    const sortedKeys = Object.keys(allParams).sort();
    const canonicalizedQueryString = sortedKeys
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(allParams[key]))
      .join('&');
    
    // 构建签名字符串
    const stringToSign = 'POST&' + encodeURIComponent('/') + '&' + encodeURIComponent(canonicalizedQueryString);
    
    // 计算签名
    const key = accessKeySecret + '&';
    const signature = CryptoJS.HmacSHA1(stringToSign, key).toString(CryptoJS.enc.Base64);
    
    // 添加签名到参数
    allParams.Signature = signature;
    
    // 构建URL参数字符串
    const queryString = Object.keys(allParams)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(allParams[key]))
      .join('&');
    
    log('发送阿里云翻译请求:', { 
      text: text.substring(0, 30) + (text.length > 30 ? '...' : ''), 
      from, 
      to,
      url: apiUrl
    });
    
    // 创建AbortController用于请求超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    try {
      // 发送请求
      const response = await fetch(apiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: queryString
      });
      
      // 清除超时计时器
      clearTimeout(timeoutId);
      
      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        log('阿里云翻译响应错误:', { 
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        // 检查是否是权限错误
        if (errorText.includes('NoPermission') || errorText.includes('AccessDenied')) {
          throw new Error('阿里云翻译API权限错误: 请确保您的账户有权调用机器翻译API。请登录阿里云控制台检查RAM权限设置。');
        }
        
        throw new Error(`HTTP错误: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // 详细记录响应
      log('阿里云翻译响应:', data);
      
      if (data.Code && data.Code !== '200') {
        throw new Error(`阿里云翻译错误: ${data.Code} - ${data.Message}`);
      }
      
      if (data.Data && data.Data.Translated) {
        console.log('✅ [阿里云翻译] 翻译成功', {
          原文预览: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          译文预览: data.Data.Translated.substring(0, 50) + (data.Data.Translated.length > 50 ? '...' : '')
        });
        return data.Data.Translated;
      } else {
        const resultStr = JSON.stringify(data);
        throw new Error(`阿里云翻译返回结果格式错误: ${resultStr.substring(0, 100)}`);
      }
    } catch (fetchError) {
      // 清除超时计时器
      clearTimeout(timeoutId);
      
      // 处理不同类型的网络错误
      if (fetchError.name === 'AbortError') {
        throw new Error('阿里云翻译API请求超时');
      } else if (fetchError.message.includes('Failed to fetch') || 
                fetchError.message.includes('Network request failed')) {
        throw new Error('网络连接失败，无法连接到阿里云翻译API');
      } else {
        throw fetchError; // 重新抛出其他错误
      }
    }
  } catch (error) {
    console.error('❌ [阿里云翻译] 发生错误:', error.message);
    throw error;
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[后台脚本] 收到消息:', request.action, request.messageId || '');
  
  // 侧边栏翻译按钮发送的ping请求
  if (request.action === 'ping') {
    console.log('[后台脚本] 收到ping请求，回复成功');
    sendResponse({ success: true, message: "后台脚本正在运行" });
    return true;
  }
  
  // 处理翻译请求 - 识别"translate"和"TRANSLATE"
  if (request.action === 'translate' || request.action === 'TRANSLATE' || request.action === 'translateSelection') {
    console.log('[后台脚本] 收到翻译请求:', request.text?.substring(0, 30) + '...');
    
    if (!request.text) {
      console.error('[后台脚本] 翻译请求缺少文本');
      sendResponse({ 
        success: false, 
        error: '翻译文本不能为空', 
        messageId: request.messageId || request.requestId 
      });
      return true;
    }
    
    // 执行翻译
    (async function() {
      try {
        console.log('[后台脚本] 开始翻译文本:', request.text.substring(0, 30));
        
        // 获取当前选择的翻译引擎
        const { translationEngine } = await new Promise((resolve) => {
          chrome.storage.local.get(['translationEngine'], resolve);
        });
        
        // 获取源语言和目标语言，默认从自动检测翻译到中文
        const from = request.from || 'auto';
        const to = request.to || 'zh';
        
        let translation;
        
        console.log('[后台脚本] 当前翻译引擎:', translationEngine || 'ollama', 
                    '源语言:', from, '目标语言:', to);
        
        // 根据选择的引擎调用相应的翻译函数
        switch (translationEngine) {
          case 'baidu':
            translation = await baiduTranslate(request.text, from, to);
            break;
          case 'aliyun':
            translation = await aliyunTranslate(request.text, from, to);
            break;
          case 'ollama':
          default:
            translation = await ollamaTranslate(request.text, from, to);
            break;
        }
        
        console.log('[后台脚本] 翻译成功:', translation?.substring(0, 30));
        
        sendResponse({ 
          success: true, 
          translation: translation,
          messageId: request.messageId || request.requestId
        });
      } catch (error) {
        console.error('[后台脚本] 翻译失败:', error);
        sendResponse({ 
          success: false, 
          error: error.message || '翻译失败',
          messageId: request.messageId || request.requestId
        });
      }
    })();
    
    return true; // 保持消息通道开放以便异步响应
  }
  
  if (request.action === "settingsUpdated") {
    // 设置更新通知
    console.log("[Background] 接收到设置更新通知:", request.settings);
    sendResponse({ success: true, message: "设置更新已接收" });
    return true;
  }
  
  if (request.action === "fetchModels") {
    // 获取Ollama模型列表请求
    console.log("[Background] 收到获取Ollama模型列表请求");
    
    // 获取Ollama API地址
    (async function() {
      try {
        const { ollamaEndpoint } = await new Promise((resolve) => {
          chrome.storage.local.get(['ollamaEndpoint'], resolve);
        });
        
        const endpoint = ollamaEndpoint || 'http://localhost:11434';
        console.log(`[Background] 从 ${endpoint} 获取模型列表`);
        
        const response = await fetch(`${endpoint}/api/tags`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Background] 获取模型列表失败:', errorText);
      sendResponse({ 
        success: false, 
            error: `获取模型列表失败: ${response.status} ${response.statusText}`
          });
          return;
        }
        
        const data = await response.json();
        console.log('[Background] 获取到模型列表:', data);
        
        if (data && data.models && Array.isArray(data.models)) {
          // 提取模型名称
          const models = data.models.map(model => {
            return typeof model === 'string' ? model : model.name;
          }).filter(Boolean);
          
        sendResponse({
          success: true,
            models: models
        });
      } else {
        sendResponse({
          success: false,
            error: '模型数据格式不正确'
        });
      }
    } catch (error) {
        console.error('[Background] 获取模型列表错误:', error);
      sendResponse({
        success: false,
          error: error.message || '获取模型列表失败'
        });
      }
    })();
    
    return true; // 保持消息通道开放以便异步响应
  }
  
  // 其他请求类型
  console.log("[Background] 未知请求类型:", request.action);
  sendResponse({ success: false, error: "未知的请求类型" });
  return true;
});

// 初始化
initialize().catch(error => {
  log('初始化过程中出错:', error);
});

log('后台脚本已加载');