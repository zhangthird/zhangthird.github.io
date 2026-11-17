---
title: "从零实现 ReAct Agent：原理、代码与工程实践"
description: "从 ReAct 的 Thought–Action–Observation 思路出发，实现完整的工具调用循环，分析消息状态、参数校验、终止条件、错误恢复及 Agent Harness 的工程边界。附可运行示例和交互演示。"
pubDate: 2026-08-21
updatedDate: 2026-11-18
tags: ["Agent 算法", "ReAct", "工具调用", "Agent Harness"]
featured: true
draft: false
readingTime: "16 min read"
demo: "agent-loop"
---

如今，一个能调用工具的大语言模型 Agent 往往只需要一个很短的主循环：**模型决定下一步动作，运行时执行被允许的工具，将观察结果返回模型，再决定继续还是结束。** 但真正值得理解的是主循环背后的状态、消息协议、边界条件与失败处理。只写一个无限循环，离可靠的 Agent 运行时还有明显距离。

本文从 ReAct 的原始思想讲起，逐步分析一个现代 Tool-Calling Agent 的最小执行流程，并提供一份**可直接运行、无需 API Key 也能复现**的 JavaScript 示例。示例围绕“查询项目预算并计算余额”展开，另外支持通过兼容 Chat Completions 的接口接入真实模型。全文还结合 [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 的渐进式教学思路讨论工具注册、权限控制和 Harness 的可扩展性。

先说明边界：这里演示的是 **ReAct 思想在现代工具调用 Agent 中的一种工程实现**。经典 ReAct 论文显式交替生成 Thought、Action 和 Observation；现代模型通常通过结构化 Tool Calling 表达 Action，并不需要暴露模型的私有推理内容。

## 一、ReAct 的核心思想

[ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) 由 Yao 等人提出，发表于 ICLR 2023。其出发点是将推理和环境交互结合：模型根据已有信息决定动作，环境返回新信息，模型再据此调整接下来的行为。

经典形式可以写成：

- **Thought**：根据任务与当前观察决定怎样推进；
- **Action**：选择搜索、查询或其他环境动作；
- **Observation**：获得工具或环境的真实反馈；
- 持续迭代，直到得出答案或需要结束。

以查询项目剩余预算为例。Agent 不应该直接猜一个金额，而应该先调用查询工具拿到预算与已用费用，再调用计算工具，最后给出基于真实数据的回答。如果工具查不到项目，下一步则应依据错误反馈决定是修正参数还是告知用户。

关键思想并不依赖某种固定的“Thought:”字符串格式；真正决定行为的是：**模型的动作能改变或观察环境，观察结果又能影响下一轮决策。**

## 二、把 Agent Loop 看成一个状态机

假设第 $t$ 轮 Agent 能看到的状态为 $s_t$，其中包含任务、对话历史和此前的工具观察。模型根据状态选择动作 $a_t$：

$$
a_t \sim \pi_\theta(a\mid s_t)
$$

如果动作是工具调用，环境返回观察 $o_{t+1}$，运行时负责更新状态：

$$
s_{t+1}=F(s_t,a_t,o_{t+1})
$$

如果模型给出最终回答、耗尽执行预算或遇到不可恢复的异常，运行时进入相应终止状态。因此 Agent Loop 更适合建模为带有明确转移条件的状态机。

~~~mermaid
flowchart TD
    A["用户任务与消息状态"] --> B["调用模型"]
    B --> C{"返回工具调用？"}
    C -->|"是"| D["校验参数与权限"]
    D --> E["执行工具或拒绝操作"]
    E --> F["收集 Observation 并写入消息"]
    F --> G{"超时 / 轮次 / 调用预算？"}
    G -->|"否"| B
    G -->|"是"| H["返回未完成状态"]
    C -->|"否"| I{"正常结束？"}
    I -->|"是"| J["输出最终回答"]
    I -->|"否"| H
    J --> K["按业务需要独立验证任务结果"]
~~~

*图：结构化工具调用 Agent 的控制流。工具执行、权限和终止由运行时管理，而不是直接由模型代码执行。*

这种设计至少包含四个角色：**Model** 决定工具或文本回复；**Tool Registry** 给出可用工具与参数规范；**Runtime / Harness** 执行工具并管理状态；**Verifier** 在有条件时检查业务目标是否真正实现。最终结果验证并不属于原始 ReAct 必须包含的部分，但它对真实任务的可靠性很有帮助。

## 三、最小 Agent 的消息协议

在现代工具调用 API 中，典型交互不只是 User 与 Assistant 的文本往返。模型返回的 assistant 消息可能包含一个或多个结构化工具调用，每个调用有工具名、JSON 参数与唯一 ID。运行时执行以后，再将带有相同 ID 的 Tool Result 写回上下文。

例如，任务是“查询 project-alpha 的预算余额”，一次正常执行可以分成以下几轮：

| 轮次 | 模型或运行时 | 关键内容 |
| --- | --- | --- |
| 用户输入 | User | 查询 project-alpha 的剩余预算 |
| 第 1 次模型请求 | Assistant / Tool Call | get_project_budget(project-alpha) |
| 第 1 次工具结果 | Tool | budget = 3000，spent = 1240 |
| 第 2 次模型请求 | Assistant / Tool Call | calculate_remaining(3000, 1240) |
| 第 2 次工具结果 | Tool | remaining = 1760 |
| 第 3 次模型请求 | Assistant / Final | 根据工具结果，剩余预算为 1760 元 |

这里有两个容易遗漏的细节。

第一，**模型发出工具调用不代表工具已执行成功**。工具可能不存在、参数不合法、权限不足或执行超时，这些都应作为可观察的结果处理。

第二，一次 assistant 消息可能包含**多个工具调用**。每个 call ID 都需要一条对应的工具结果；如果调用预算不足以执行这一批工具，就不能随意留下缺失结果的半条消息历史，否则后续模型请求可能因协议不完整而失败。

## 四、真正需要写进代码的几个模块

[完整可运行示例：examples/react-agent-loop/agent.mjs](https://github.com/zhangthird/zhangthird.github.io/blob/main/examples/react-agent-loop/agent.mjs)

完整示例采用 Node.js 22+ 的原生 JavaScript，只使用标准库和内置 fetch，包含以下模块。

| 模块 | 职责 | 为什么需要 |
| --- | --- | --- |
| TOOL_SPECS | 向模型说明工具名称、作用与参数结构 | 给模型明确的可用动作空间 |
| TOOL_HANDLERS | 把工具名映射到实际函数 | 防止模型任意执行未注册的函数 |
| executeTool | JSON 解析、参数校验、调用与错误包装 | 将不可信的模型输出隔离在执行边界外 |
| runAgent | 消息管理、模型请求、工具反馈和预算限制 | 保持可观察、可控的执行循环 |
| createDemoClient | 提供确定性的离线模拟模型 | 无需 API Key 就能复现协议与状态变化 |
| createChatClient | 接入兼容 Chat Completions 的模型服务 | 以相同循环替换模拟模型 |

核心循环保留了非常简单的形状：

~~~js
for (let turn = 1; turn <= maxTurns; turn++) {
  const response = await client.complete({
    messages,
    tools: TOOL_SPECS,
  });

  const calls = response.tool_calls ?? [];
  messages.push(response); // 简化展示；实际实现会规范化消息

  if (calls.length === 0) {
    return { status: "finished", answer: response.content };
  }

  for (const call of calls) {
    const observation = await executeTool(call, TOOL_HANDLERS);
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(observation),
    });
  }
}
~~~

*代码：简化后的控制流。此片段用于解释思路，不包含完整的预算检查、异常与消息验证。运行请使用仓库中的完整示例。*

其中运行时负责参数校验和工具执行，模型只提供“想调用什么”的结构化请求。把两者分开，是设计稳定 Agent Harness 的基础。

## 五、运行完整示例

如果已经安装 Node.js 22 或更新版本，可以克隆网站仓库后直接运行：

~~~bash
git clone https://github.com/zhangthird/zhangthird.github.io.git
cd zhangthird.github.io
node examples/react-agent-loop/agent.mjs
~~~

默认启动**离线模拟模式**，无需注册账号或设置密钥。程序会依次模拟两个工具调用并打印结构化轨迹，然后返回项目余额。正常结果包含三个模型轮次、两次工具调用以及剩余预算 1760 元。因为模型行为是预设的，这一模式**仅用于教学和测试消息协议，不代表真实模型的自主推理能力**。

如果要使用真实模型，可以配置支持 Chat Completions 格式的服务。下面是 Bash 的写法：

~~~bash
export LLM_API_KEY="你的密钥"
export LLM_MODEL="支持工具调用的模型ID"
export LLM_BASE_URL="你的服务地址/v1"
node examples/react-agent-loop/agent.mjs "查询 project-alpha 的预算余额"
~~~

在 Windows PowerShell 中，环境变量可以使用如下形式：

~~~powershell
$env:LLM_API_KEY = "你的密钥"
$env:LLM_MODEL = "支持工具调用的模型ID"
$env:LLM_BASE_URL = "你的服务地址/v1"
node examples/react-agent-loop/agent.mjs
~~~

不同模型提供方可能采用不完全相同的工具调用协议，此示例面向兼容 **Chat Completions 风格**的接口。即使服务端接受该接口，也需要确认所选模型确实支持结构化工具调用。不应将密钥提交到代码仓库。

## 六、完整示例比最初的 while 循环多做了什么？

### 1. 限制模型轮次和工具调用次数

真正运行的 Agent 可能重复请求同一个工具，或者因错误反馈而持续尝试。完整示例设置 maxTurns 与 maxToolCalls，并用不同状态标记 finished、max_turns、max_tool_calls、incomplete、model_error。

这里必须区分：**一次模型请求不一定等于一次工具调用**。模型可能并行请求多个工具，所以需要分别维护模型轮次与工具调用预算。进一步的工程版本还应考虑运行总时长、Token 预算、工具费用和用户取消。

### 2. 工具调用必须通过白名单与参数校验

模型能生成任意文本，因此不能简单把工具名当作代码执行，也不能让模型任意调用 Shell。示例只开放查询预算与计算余额两类预设函数。

在 executeTool 中，即使模型传入一个不存在的工具名、格式错误的 JSON 或数值参数以外的内容，运行时也会返回结构化错误。**Schema 说明影响模型生成，真正的安全边界还必须由运行时代码实施。**

对实际文件、Shell 和网页操作，还需要路径范围限制、沙箱、最小权限和用户审批。简单的危险字符串黑名单并不能代替可靠的权限模型。

### 3. 错误也应返回给模型

如果查询工具返回“项目不存在”，可以将错误作为 Observation 写入消息。模型随后可以调整参数、请求用户提供正确标识，或者解释无法完成的原因。

需要强调的是：不能对有副作用的工具进行无条件自动重试。付款、发送邮件、提交订单等操作需要幂等键、去重策略或人工确认，否则重复调用可能造成真实损失。

### 4. 保留结构化运行轨迹

示例提供 onEvent 回调，在模型决策、工具执行和错误发生时输出简洁的事件记录。工程系统通常还会保存请求 ID、时间、调用费用、执行结果、关键状态变更与最终业务验证结果。

日志可以辅助定位“模型选择错误工具”“参数不合法”“工具失败”“模型过早结束”等不同失败原因。但生产环境应对用户输入、工具结果及密钥做适当脱敏。

## 七、什么时候算真正结束？

这是 Agent Loop 设计里容易被忽略的问题。

**模型停止调用工具，只能说明模型认为可以结束；它并不能证明任务已经完成。** 在本例中，Agent 最后说“剩余预算 1760 元”，可以进一步用独立的业务逻辑核对预算和已用金额。对 Coding Agent，则可以运行测试；对 Browser Agent，可以检查实际环境状态。

因此，应明确区分：

- **停止条件（Stop Condition）**：模型正常输出最终回答、达到预算上限、用户取消或系统异常。
- **成功条件（Success Condition）**：独立检查业务目标与硬性约束是否满足。

如果把两者混为一谈，就会出现“模型说做完了，但文件根本没生成”的典型错误。关于结果与轨迹评测，可以继续阅读[《如何判断 Agent 是否完成任务？》](/research/how-to-evaluate-agent-task-completion/)。

## 八、从最小循环走向 Agent Harness

[shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 给出了一条很有启发性的渐进路线：从 s01 的单工具循环开始，到 s02 的工具分发，再加入权限、Hooks、任务管理、上下文压缩、Subagent、MCP 和目标完成检查。其重点是让复杂机制围绕同一个基础循环组合，而不必每新增功能就推翻整个主循环。

但需要注意，**Agent Harness 不是“让模型有智能”的替代品**。它管理模型可以访问什么、怎样观察结果、如何恢复和停止。模型能力、工具质量、状态管理和执行环境会共同决定最终的 Agent 表现。

实际系统常见的演进顺序是：先让单工具链路可观察和可测试，再扩展多个工具、验证器、权限策略、持久化、长上下文和多 Agent 协作。对于固定且可程序化的流程，直接用确定性的工作流通常更便于控制；对于需要动态探索和工具选择的任务，再让模型决定下一步动作。

## 九、常见问题与调试思路

| 现象 | 常见原因 | 建议排查 |
| --- | --- | --- |
| Agent 一直重复工具调用 | 缺少有效进展信号或停止预算 | 检查工具结果是否入上下文，增加轮次与重复检测 |
| 工具已经成功，Agent 却说失败 | 工具结果缺少必要字段、上下文被截断 | 对照工具输出与模型消息 |
| 模型工具参数经常不合法 | Schema 含糊、模型不支持或协议不一致 | 最小化工具参数，并在运行时验证 |
| 调用工具后 API 报错 | tool_call_id 与 tool_result 不匹配 | 检查消息顺序与 ID 配对 |
| 任务尚未完成，Agent 就结束 | 模型的停止判断与业务成功条件混淆 | 加入独立终态验证或目标检查 |
| 上下文越来越长 | 工具输出和旧轨迹不断累积 | 设置输出上限，并在保留证据的前提下压缩上下文 |
| 模型根据网页内容执行危险动作 | 工具输出中的提示注入 | 对不可信内容设置边界并执行权限校验 |

## 十、总结

理解 ReAct Agent 不需要先掌握大型框架。最核心的机制可以概括为：

**模型选择动作 → Harness 校验并执行 → 环境返回观察 → 状态更新 → 模型继续决策或结束。**

但一个真正能用于实际任务的实现，还需要独立处理调用次数与成本预算、输入校验、权限、工具异常、消息配对和任务成功验证。把这些边界写清楚，比把循环堆成复杂的流程图更有工程价值。

## 参考资料

1. Yao et al. [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629), ICLR 2023。
2. shareAI-lab. [learn-claude-code：从 Agent Loop 到完整 Harness 的渐进教程](https://github.com/shareAI-lab/learn-claude-code)。
3. [本文章可运行的 ReAct Agent 示例代码](https://github.com/zhangthird/zhangthird.github.io/blob/main/examples/react-agent-loop/agent.mjs)。
4. [《如何判断 Agent 是否完成任务？》](/research/how-to-evaluate-agent-task-completion/)。

## 附：交互式执行流程

下方交互演示采用与本文示例一致的预算数据。它是一个确定性的前端模拟，用于展示模型决策、工具返回、状态更新和结束核验之间的关系；**不会连接模型 API，也不会操作真实业务系统**。
