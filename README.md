<p align="center">
  <img src="demo.gif" alt="Maribbit's Blog — animated demo: a room, a window over a breathing sea, a character that breathes." width="400" />
</p>

<p align="center">
  <b>Maribbit's Blog <br/>
  海兔的博客</b><br/>
</p>


## Project Definition ｜ 项目定义

This project is Maribbit's personal blog, exploring AI-assisted graphic programming.

这是一个个人博客项目，探索 AI 辅助的图形化编程。

## License ｜ 开源协议

This project is **dual-licensed**:

- **Code** (Astro components, TypeScript utilities, styles, configuration) — [MIT License](LICENSE). You are free to use, modify, and distribute the code.
- **Art & Content** (the character, SVG illustrations, scene assets, `og.jpg`, and any textual content) — [CC BY-NC-SA 4.0](LICENSE-CC-BY-NC-SA-4.0). NonCommercial use only; you may share and adapt with attribution and share-alike.

> **Trademark notice**: The GitHub and Xiaohongshu (小红书) logos used in the About page belong to their respective owners and are not covered by the licenses above.

本项目采用**双协议**：

- **代码**（Astro 组件、TypeScript 工具、样式、配置）— [MIT 协议](LICENSE)，可自由使用、修改、分发。
- **美术与内容**（角色、SVG 插画、场景素材、`og.jpg` 及文字内容）— [CC BY-NC-SA 4.0](LICENSE-CC-BY-NC-SA-4.0)，仅限非商业使用，须署名且以相同方式共享。

> **商标声明**：关于页面使用的 GitHub 与小红书图标分属其各自权利人所有，不受上述协议约束。

## Technologies Used ｜ 核心技术

These aspects were considered in the selection and implementation of this project:

- **Low bundle size**: Minimize JavaScript size to ensure fast loading and performance.
- **Low dependencies**: Minimize external dependencies to reduce maintenance costs and potential security risks.
- **High-performance rendering**: Use GPU-accelerated rendering methods whenever possible to ensure smooth animations.

本项目的选型与实现主要考虑几个方面：

- **低打包体积**：尽可能减少 JavaScript 体积，保证博客加载速度和性能。
- **低依赖**：尽量减少外部依赖，降低维护成本和潜在的安全风险。
- **高性能渲染**：尽可能使用 GPU 加速的渲染方式，保证动画流畅。

### Astro

I like its concept of "islands architecture" and its ability to generate static sites with minimal JavaScript.

我喜欢 Astro 的“岛屿架构”概念，以及它生成静态站点时对 JavaScript 的最小化依赖。

## Coding Tools ｜ 编程工具

Graphic programming is really challenging at the code level. The challenge is not the usual engineering problems, but simulating real-world physical and biological phenomena with numbers. So I hardly wrote any code myself, mainly relying on AI to implement it.

图形编程在代码层面真的很有难度。它的挑战不是通常的工程问题，而是用数字模拟现实世界的物理和生物现象。所以我自己几乎没写代码，主要依赖 AI 来实现。

### GitHub Copilot in VS Code

I need the sense of control over code that VS Code provides, and GitHub Copilot is a great addition. It also supports custom models well, allowing me to use cheaper models for code generation.

我需要 VS Code 对代码的掌控感，加上 GitHub Copilot 算是如虎添翼。而且它对自定义模型的支持也不错，让我可以使用更便宜的模型来生成代码。

### DeepSeek V4 Flash

This is currently my main programming model. It is very cheap and powerful enough. Although it cannot read images directly yet, it can understand the effects I want very well just through text descriptions.

这是目前我的主力编程模型。它非常便宜，且足够强大。虽然它还不能直接阅读图片，但仅仅通过文字描述，它就能很好地理解我想要的效果。

### Gemini and Nano Banana

This is my main design model. It is reasonably priced and performs well in image understanding and generation. I will have it help me design complex image elements such as characters and scenes.

这是我的主力设计模型。它价格合理，且在图像理解和生成方面表现出色。我会让它帮我设计人物、场景等复杂的图像元素。