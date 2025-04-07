# 网页实时翻译扩展

一个强大的浏览器扩展，可以实时翻译网页内容，支持多种翻译模式和多个翻译引擎。

## 功能特点

- **多种翻译模式**：
  - 轻量模式：仅翻译选定的文本内容
  - 完整模式：可翻译整个网页内容
  - 侧边栏全文翻译：一键翻译整个页面，自动处理滚动加载的内容

- **智能语言检测**：
  - 自动识别文本语言，只翻译非目标语言的内容
  - 避免对已经是目标语言(中文)的文本进行重复翻译
  - 智能分析文本中的语言占比，提高翻译精准度
  
- **多个翻译引擎**：
  - 本地大模型翻译（Ollama）
  - 百度翻译API
  - 阿里云翻译API
  - 自动切换功能：当一个翻译引擎失败时，自动切换到另一个

- **高效缓存**：
  - 内置翻译缓存机制，减少重复请求
  - 提高翻译速度，节省API调用次数

- **高级页面分析**：
  - 智能识别网页主要内容区域
  - 避免翻译导航、页脚等非关键区域
  - 针对不同网站类型（博客、论坛、代码仓库等）优化翻译体验

- **自动内容检测**：
  - 使用交叉观察器(Intersection Observer)监测元素可见性
  - 自动翻译滚动时新出现的内容
  - 监测DOM变化，确保动态加载的内容也能被翻译

- **错误恢复机制**：
  - 自动检测和恢复扩展连接中断
  - 翻译失败时自动重试
  - 友好的错误提示，指导用户解决问题

- **用户友好界面**：
  - 简洁的弹出设置菜单
  - 动画过渡效果
  - 清晰的状态反馈
  - 浮动翻译按钮，便于随时开启或关闭翻译功能

## 系统架构

- **后台脚本** (`background.js`)：
  - 管理翻译API调用
  - 处理翻译缓存
  - 提供消息通信接口

- **内容脚本** (`content.js`, `content-simple.js`)：
  - 处理页面DOM元素识别
  - 管理翻译结果的显示
  - 处理用户交互

- **侧边栏翻译** (`sidebar-translator.js`)：
  - 提供页面全文翻译能力
  - 智能处理滚动加载内容
  - 使用观察器技术监控页面变化

- **弹出窗口** (`popup/popup.js`, `popup/popup.html`)：
  - 提供用户配置界面
  - 允许切换翻译模式和引擎

- **翻译核心** (`scripts/translator.js`)：
  - 包含翻译逻辑和处理函数
  - 提供API调用和错误处理

## 安装步骤

1. 克隆或下载此仓库
2. 在 Chrome 浏览器中打开扩展管理页面 (`chrome://extensions/`)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展"
5. 选择此项目文件夹

## 配置API凭据

使用此扩展需要配置翻译API凭据：

### 在线翻译API配置

1. 打开 `src/background.js` 文件
2. 替换百度翻译API的 `APPID` 和 `SECRET` 为您自己的凭据
3. 替换阿里云翻译API的 `ACCESS_KEY_ID` 和 `ACCESS_KEY_SECRET` 为您自己的凭据

```javascript
// 百度翻译API凭据
const BAIDU_API_CREDENTIALS = {
  APPID: '您的百度翻译APPID', 
  SECRET: '您的百度翻译密钥'
};

// 阿里云翻译API凭据
const ALIYUN_API_CREDENTIALS = {
  ACCESS_KEY_ID: '您的阿里云AccessKeyID',
  ACCESS_KEY_SECRET: '您的阿里云AccessKeySecret'
};
```

### 本地大模型（Ollama）配置

如果您想使用本地大模型进行翻译，需要先安装和配置 Ollama：

1. **安装 Ollama**
   - 访问 [Ollama官网](https://ollama.ai/) 下载并安装 Ollama
   - 确保 Ollama 服务正在运行（默认端口为11434）

2. **下载语言模型**
   - 打开终端或命令提示符
   - 运行以下命令下载所需的模型（以 llama2 为例）：
     ```bash
     ollama pull llama2
     ```
   - 您也可以选择其他支持中英互译的模型

3. **在扩展中配置 Ollama**
   - 点击扩展图标打开设置面板
   - 在翻译引擎下拉菜单中选择"本地大模型(Ollama)"
   - 填写 Ollama API 地址（默认为 http://localhost:11434）
   - 填写模型名称（例如：llama2）
   - 点击"测试连接"确保配置正确
   - 点击"保存设置"完成配置

4. **使用注意事项**
   - 确保 Ollama 服务持续运行
   - 首次使用时翻译速度可能较慢，这是模型加载所需
   - 翻译质量取决于所选模型的性能
   - 建议使用支持中英互译的大模型以获得更好的翻译效果
   - 本地翻译不会产生API调用费用，但会占用本地计算资源

## 使用方法

### 基本使用

1. 安装扩展后，在浏览器右上角会出现扩展图标
2. 点击图标打开设置面板
3. 选择您偏好的翻译模式（轻量/完整）
4. 默认使用本地大模型(Ollama)进行翻译，您也可以切换到百度翻译或阿里云翻译
5. 在网页上选中文本后，将自动显示翻译结果

### 侧边栏全文翻译功能

1. 在访问英文网页时，页面右侧会显示一个浮动的翻译按钮
2. 点击该按钮一次，将自动开始翻译页面中所有可见内容
3. 当滚动页面时，新出现的内容会自动被翻译
4. 再次点击按钮可以关闭翻译功能
5. 系统会智能识别内容语言，只翻译非中文的内容
6. 对于代码仓库页面（如GitHub或Gitee），系统会进行特殊优化以更好地展示README和代码注释

### 智能语言检测

- 扩展会自动分析文本内容，检测是否为中文
- 如果文本已经是中文（超过40%的中文字符），则不会进行翻译
- 这避免了对已经是目标语言的内容进行不必要的翻译
- 系统会在复杂的混合语言内容中智能判断是否需要翻译

## 注意事项

- 翻译API可能有调用次数和频率限制
- 需要联网使用
- 百度翻译API和阿里云翻译API需要单独申请
- 侧边栏全文翻译功能在处理大型页面时可能需要一些时间

## 版权和许可

### 版权声明

Copyright © 2024 成都时光赛博科技有限公司。

本软件的原始知识产权归属于成都时光赛博科技有限公司。

### MIT 许可证

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

简体中文译文：

特此免费授予任何获得本软件及相关文档文件（"软件"）副本的人不受限制地处理本软件的权利，
包括但不限于使用、复制、修改、合并、发布、分发、再许可和/或出售该软件的副本，
以及允许获得该软件的人这样做，但须符合以下条件：

上述版权声明和本许可声明应包含在本软件的所有副本或重要部分中。

本软件按"原样"提供，不提供任何形式的明示或暗示的保证，包括但不限于对适销性、特定用途的
适用性和非侵权性的保证。在任何情况下，作者或版权持有人均不对任何索赔、损害或其他责任负责，
无论是在合同诉讼、侵权行为或其他方面，由软件或软件的使用或其他交易引起、产生或与之相关。

## 开发者信息

### 调试扩展

1. 在后台页面中打开开发者工具：
   - 在扩展管理页面点击"背景页"
   - 查看控制台输出的日志信息

2. 内容脚本调试：
   - 在任意网页上打开开发者工具
   - 查看控制台输出的`[Translator]`、`[Content]`和`[SidebarTranslator]`前缀的日志

### 项目结构

```
translator/
├── config/                  # 配置文件
│   └── api-credentials.js   # API凭据配置
├── icons/                   # 扩展图标
├── popup/                   # 弹出窗口
│   ├── popup.html           # 弹出窗口HTML
│   └── popup.js             # 弹出窗口脚本
├── scripts/                 # 主要脚本
│   ├── background.js        # 后台脚本
│   ├── content.js           # 内容脚本
│   ├── content-simple.js    # 轻量模式内容脚本
│   ├── sidebar-translator.js # 侧边栏全文翻译功能
│   ├── translator.js        # 翻译核心逻辑
│   ├── translator-module.js # 翻译模块
│   ├── crypto.js            # 加密工具
│   ├── crypto-util.js       # 加密辅助函数
│   └── crypto-js.min.js     # CryptoJS库
├── styles/                  # 样式文件
│   ├── content.css          # 内容样式
│   └── sidebar-button.css   # 侧边栏按钮样式
├── _locales/                # 本地化文件
├── manifest.json            # 扩展清单文件
└── README.md                # 项目说明文档
```

## 贡献与反馈

如果您发现任何问题或有改进建议，请提交PR。