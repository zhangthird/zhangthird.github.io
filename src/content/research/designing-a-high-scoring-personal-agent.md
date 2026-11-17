---
title: "如何设计一个高分 Personal Agent？从动态用户状态到约束感知的记忆介入"
description: "以 Personal Agent 的长期任务成功率为目标，系统讨论时序化记忆、偏好约束编译、执行中动态介入、主动协助策略与可验证执行，并给出 CAMI 算法、训练和消融实验方案。"
pubDate: 2026-11-18
tags: ["Agent 算法", "Personal Agent", "长期记忆", "个性化", "强化学习"]
featured: false
draft: false
readingTime: "19 min read"
---

如果让我设计一个 Personal Agent，希望它在长期交互和真实任务执行的 Benchmark 上取得较高分数，我的切入点不是简单增加长期记忆容量、Agent 数量或工具调用次数，而是解决一个更具体的问题：

**Agent 如何在不断变化的用户信息中识别当前有效的偏好和约束，并在正确的执行节点将它们转化为行动？**

一个个人智能体可能准确记住用户的喜好，却仍然在订票时选错时间、在发邮件前重复询问已知信息，或者沿用早已失效的偏好。这些失败说明，记忆准确率和真正的个性化任务完成率之间存在距离。

本文提出一个可实现的研究方案：**PACE（Personalized Autonomous Contextual Executive）**，并将主要算法切入点收敛为 **CAMI（Constraint-Aware Memory Intervention，约束感知的记忆介入）**。这是一套待验证的设计，不代表已完成实验或已被证明优于现有方法。

## 一、先确定评测对象：Personal Agent 的高分意味着什么？

Personal Agent 至少需要同时做好五类事情：从长期交互中理解用户，识别随时间变化的偏好，完成跨应用的真实任务，在适当时候主动协助，以及始终遵守权限和隐私限制。

现有研究可以为这些能力提供不同的测评切面：

| Benchmark / 工作 | 重点 | 对设计的启发 |
| --- | --- | --- |
| [LongMemEval（ICLR 2025）](https://arxiv.org/abs/2410.10813) | 信息提取、跨会话推理、时间推理、知识更新和拒答 | 记忆必须处理时间和变化 |
| [PersonaAgent（Findings of ACL 2026）](https://aclanthology.org/2026.findings-acl.1315/) | 将长期用户记忆与个性化行动结合 | 不能只评估记住了什么 |
| [MemPABench（2026）](https://arxiv.org/abs/2610.30485) | 交互偏好、重复询问、不同情境下的偏好应用 | 有记忆不代表会正确使用 |
| [Pulse（2026）](https://arxiv.org/abs/2611.00988) | 长程任务执行中的流式个性化记忆介入 | 记忆可以在执行中动态补充 |
| [VitaBench 2.0](https://vitabench2.github.io/) | 长期个性化与主动协助，兼顾执行轨迹和结果 | 主动性和执行质量需要联合评估 |

这些 Benchmark 的任务、指标和环境不同，不能将其分数直接加权得到一个所谓统一排行榜。如果自建 PACE-Bench，我会将长期任务完成率设为主要指标，另行报告记忆状态推理、偏好遵循、主动协助、权限违规、用户打扰和执行成本。

对于未经授权发送消息、泄露隐私、重复付款等高风险行为，需要**独立的安全判定**。即使最终目标实现，违反强制约束的轨迹也不能被评为完整成功。

## 二、真正的技术问题：记忆什么时候应该变成约束？

考虑一个持续数周的任务：

> 帮我安排和导师的会议，并整理会前材料。

用户的历史信息可能包含：

- 曾经偏好上午开会；
- 最近上午开始有固定课程；
- 这周明确提出会议尽量安排下午；
- 发送正式邀请之前需要用户确认；
- 上一次会议尚有两项行动项没有完成。

传统 RAG 可以检索这些文本，但仍需要模型理解它们之间的时间顺序、适用范围与优先级。更麻烦的是，**某条记忆可能在搜索阶段不重要，却在创建日历事件或发送邀请前变得关键**。

因此，我认为 Personal Agent 的决策至少包含三个连续环节：

1. **用户状态估计**：当前有哪些仍然有效的事实、目标、偏好与授权？
2. **约束编译**：将自然语言偏好转换为可用于规划与检查的条件。
3. **执行时介入**：在候选工具调用出现时，决定是否补充记忆、修正行动或请求授权。

这里最值得研究的，不是离线构造一份更长的用户画像，而是**用户状态变化如何实时改变 Agent 的动作空间和动作价值**。

## 三、系统架构：单主 Agent + 个性化控制器 + 独立执行验证

第一版不需要复杂的多 Agent 群体。我会用一个主执行 Agent 处理规划与工具调用，另外设置轻量级的个性化控制模块和独立检查层。

~~~mermaid
flowchart TD
    A["用户请求 / 日程事件 / 任务变化"] --> B["任务状态与意图解析"]
    M[("时序化用户记忆")] <--> C["用户状态更新与检索"]
    B --> C
    C --> D["偏好与约束编译"]
    D --> E["主 Agent：规划与候选动作"]
    E --> F{"CAMI：是否需要介入"}
    F -->|"不需要"| G["权限及硬约束检查"]
    F -->|"补充记忆"| C
    F -->|"重新规划"| E
    F -->|"请求确认"| H["用户授权"]
    H --> G
    G -->|"允许"| I["工具执行"]
    G -->|"拒绝"| E
    I --> J["环境状态验证"]
    J --> K{"目标是否实现"}
    K -->|"未完成"| E
    K -->|"已完成"| L["反馈、状态更新与技能复用"]
    L --> M
~~~

这套架构刻意区分三个角色：

**主 Agent** 负责推理、制定计划、提出候选操作及错误恢复。

**个性化控制器** 维护动态用户状态，识别当前动作是否缺少个人信息，并决定何时介入。

**执行检查层** 负责确定性的授权、硬约束及外部状态验证。这些检查不能由一个“觉得没风险”的语言模型随意跳过。

## 四、时序化用户记忆：记录事实，也记录有效条件

我会把长期记忆分为五类：稳定事实（Semantic）、偏好（Preference）、历史事件（Episodic）、目标与任务状态（Goal/Task）、交互方式（Interaction）。

每条记忆除了内容，还应保留**来源、时间、适用范围、置信度及是否仍有效**。

~~~json
{
  "id": "pref_042",
  "subject": "user",
  "key": "meeting_time",
  "value": "afternoon",
  "scope": "academic_meeting",
  "source": "explicit_user_statement",
  "confidence": 1.0,
  "valid_from": "2026-11-15",
  "valid_to": null,
  "status": "active",
  "evidence_id": "conversation_128"
}
~~~

当用户提出新信息时，状态更新器需要判定它与既有记忆的关系：新增、覆盖、临时例外、条件变化，还是证据不足的推断。

从用户行为推断“可能更喜欢下午”与用户明确要求“今后的学术会议都安排下午”，必须保留不同的可信度与强度。

对时间敏感的状态，还应区分**信息被系统观察到的时间**和**信息实际生效的时间**。例如用户今天才告知“从下周开始下午有课”，不能把这条规则错误地应用到本周。

## 五、Personal Preference Compiler：将偏好编译为可检查的条件

假设用户说：

> 优先上海、杭州、苏州的岗位，但不要未经确认就帮我投递。

这句话至少包含两种不同类型的条件：

- **软偏好**：在其他条件相近时优先指定城市；
- **硬权限约束**：未经用户确认，不得提交申请。

我会设计一个 Personal Preference Compiler（PPC），将记忆与当前任务状态编译为结构化条件：

$$
\mathcal C_t=\operatorname{Compile}(M_t,x_t)=(\mathcal H_t,\mathcal S_t,\mathcal P_t)
$$

这里，$M_t$ 表示当前记忆，$x_t$ 是任务上下文；$\mathcal H_t$ 是硬约束，$\mathcal S_t$ 是软偏好，$\mathcal P_t$ 是权限规则。

决策可以表述为：

$$
a_t^*=\arg\max_{a\in\mathcal A_t}U(a\mid x_t,\mathcal S_t)
$$

满足：

$$
a_t\in\operatorname{Feasible}(\mathcal H_t,\mathcal P_t)
$$

软偏好影响候选方案排序；硬约束决定哪些动作可执行；权限规则由独立执行层检查。

在冲突处理上，系统安全边界和有效授权必须保留；用户当前明确指令可以覆盖以前的一般性偏好，但不能自动扩大操作权限；有明确适用范围的偏好只在相应情境中生效；过期或已撤销的偏好不应继续影响决策。

这个编译器的价值是：**即使主 Agent 生成了违反已知偏好的候选方案，系统也能在真正调用工具前发现问题并定向修正。**

## 六、CAMI：在关键执行节点动态介入

只在任务开始时读取一次记忆容易遗漏后续约束；每一步都检索则造成成本和无关信息干扰。

因此我提出 **CAMI（Constraint-Aware Memory Intervention）**，让个性化控制器观察主 Agent 的当前执行状态和候选动作，选择四种响应：

| 决策 | 含义 | 典型场景 |
| --- | --- | --- |
| SILENT | 不追加介入，继续执行 | 读取公开资料、无关个人偏好的操作 |
| RETRIEVE | 检索并补充相关记忆 | 查询候选会议时间时需要用户偏好 |
| REVISE | 反馈冲突并要求重新规划 | 创建会议前发现候选时间违反当前偏好 |
| ESCALATE | 请求用户提供关键信息或授权 | 发送邮件、预订、付款等需要确认的操作 |

形式化地，设 $h_t$ 为执行历史摘要、$b_t$ 为用户状态估计、$a_t^{\mathrm{cand}}$ 为即将发生的候选动作：

$$
z_t\sim\pi_\theta(z\mid h_t,b_t,a_t^{\mathrm{cand}})
$$

其中：

$$
z_t\in\{\mathrm{SILENT},\mathrm{RETRIEVE},\mathrm{REVISE},\mathrm{ESCALATE}\}
$$

这不是让模型自行决定是否遵守权限。**CAMI 优化的是额外记忆介入的时机与内容；所有外部操作仍经过独立权限和硬约束检查。**

### 利用介入的预期信息价值

我们可以把某次介入的净收益写为：

$$
\operatorname{VOI}_t=
\mathbb E[V_{t+1}\mid\mathrm{intervene}]
-\mathbb E[V_{t+1}\mid\mathrm{continue}]
-\lambda C_t
$$

其中 $C_t$ 是介入造成的 Token、工具或延迟成本。两个期望值代表反事实策略下的预期后续价值，在真实系统中无法直接观测，需要通过模拟器、配对轨迹或学习到的价值模型估计。

最初可以用规则触发器，例如检测高风险操作、偏好敏感字段、记忆冲突或任务状态变化；积累训练数据后再学习介入策略。

### 一个具体例子

主 Agent 准备创建上午九点的学术会议，而当前明确偏好是下午。

CAMI 检索后生成：

~~~json
{
  "decision": "REVISE",
  "conflict": "候选时间与当前学术会议偏好冲突",
  "applicable_memory": ["pref_042"],
  "constraints": {
    "preferred_period": "13:00-18:00"
  },
  "suggested_next_step": "重新查询下午可用时间"
}
~~~

主 Agent 接收到的是一条**可行动的冲突信息**，而不是无差别追加几十条历史消息。

## 七、主动协助：学习何时准备、提醒、询问或执行

Personal Agent 还需要面对一类没有立即用户请求的任务，例如识别即将截止的事项、准备下周的会议材料、整理尚未完成的任务。

我会将主动行为定义为：

$$
\mathcal A_{\mathrm{pro}}=\{\mathrm{Ignore},\mathrm{Prepare},\mathrm{Notify},\mathrm{Ask},\mathrm{Act}\}
$$

其中 Prepare 表示在允许范围内提前处理，Notify 表示主动通知，Ask 表示必要时询问，Act 表示在已有授权下直接执行。

主动策略可以使用上下文 Bandit 起步，再逐渐扩展为长期强化学习。目标函数应同时考虑任务收益、用户被打扰的成本、错误风险和模型成本：

$$
U(a)=P_{\mathrm{need}}(a)P_{\mathrm{success}}(a)V(a)-\lambda_1C_{\mathrm{interrupt}}(a)-\lambda_2C_{\mathrm{error}}(a)-\lambda_3C_{\mathrm{compute}}(a)
$$

不能直接使用通知点击率作为唯一奖励：用户忽略通知不一定代表通知没有价值，而反复发送通知也可能提高点击率、同时损害使用体验。

实际训练可以结合明确反馈、修改次数、后续任务结果、通知频率与时间偏好。对于用户没有提供授权的操作，策略只允许准备、提醒或询问，不能让高预期收益抵消权限限制。

## 八、可靠执行：以真实环境状态判断是否完成

个人任务常常涉及日历、邮件、文件、报名表、购物车或外部服务。Agent 生成了令人满意的文字，不意味着任务已经完成。

我会把任务拆解成可恢复的状态机，记录每个节点的输入、输出、依赖、执行日志和成功条件。关键动作前做约束检查，动作后读取外部环境状态进行验证。

~~~python
def execute_step(task, context):
    state = load_task_and_user_state(task, context)
    candidate = main_agent.propose_action(state)

    decision = cami.decide(state, candidate)
    if decision == "RETRIEVE":
        state = augment_with_relevant_memory(state, candidate)
        candidate = main_agent.propose_action(state)
    elif decision == "REVISE":
        return replan_with_constraints(task, state, candidate)
    elif decision == "ESCALATE":
        return request_required_confirmation(task, candidate)

    # 强制策略不由 CAMI 决定是否启用
    if not execution_guard.is_allowed(candidate, state):
        return block_and_replan(task, candidate)

    before = environment.snapshot(candidate)
    outcome = tools.execute_with_idempotency(candidate)
    after = environment.snapshot(candidate)

    verdict = verifier.check(task, candidate, outcome, before, after)
    persist_trace(task, candidate, outcome, verdict)

    if not verdict.success:
        return recover_from_failure(task, verdict)

    update_task_progress(task, after)
    return verdict
~~~

这段代码表达核心逻辑，是伪代码，并非无需依赖即可运行的完整实现。实际运行时还需要处理：用户确认后重新读取授权状态、重复操作的幂等性、外部工具超时、状态并发修改、错误恢复上限和恶意工具输出。

对可以程序验证的任务，应优先使用真实状态、API 回执或数据库记录；对文章质量、建议是否适合用户等语义问题，则结合证据约束的模型评审和人工抽样校准。

严格的任务成功可以定义为：

$$
S_{\mathrm{success}}=\mathbb I[G(s_T)=1\land C(\tau)=1]
$$

其中 $G(s_T)$ 表示最终目标成立，$C(\tau)$ 表示完整执行轨迹没有违反强制约束。这样可以避免把“最终做对，但过程中发生未经授权的副作用”计为成功。

## 九、训练策略：先把记忆介入学好，再优化长任务

我不会一开始训练庞大的端到端多 Agent 系统，而是固定基础模型与工具环境，先训练个性化控制器。

### 第一阶段：SFT 学习介入判定

从模拟用户历史、偏好变化和工具执行轨迹中构造状态—候选动作—正确介入标签。

训练数据既需要“该介入”的样本，也需要大量“无需介入”的反例，避免系统每一步都做额外搜索。还需要包含过期记忆、当前指令覆盖旧偏好、记忆来源不可信、不同情境偏好互不适用等困难案例。

### 第二阶段：偏好学习

对同一情境采样多种合理行为，让模型学会用户期望的交互方式。例如用户已经明确要求“先准备材料，发邮件前再确认”，模型应偏好先完成准备工作，而不是重复询问已有信息或未经授权直接发送。

可尝试 DPO 等偏好优化方法，但应区分用户明确偏好、推断偏好和系统安全规则。

### 第三阶段：对介入策略进行强化学习

在可复现的模拟环境中对同一任务执行不同介入策略，比较任务完成、偏好遵循和计算成本。

一个候选的轨迹奖励是：

$$
R=\alpha R_{\mathrm{task}}+\beta R_{\mathrm{preference}}+\gamma R_{\mathrm{proactivity}}-\lambda_1 C_{\mathrm{intervention}}-\lambda_2C_{\mathrm{latency}}
$$

安全约束由执行层硬性保障，并单独报告违规率。

可以尝试 GRPO 或 PPO 优化介入策略，不过选择哪种优化器不是主要创新点。真正需要证明的是：**带时间和适用范围的约束建模，以及基于候选动作的记忆介入，能否在固定模型和预算下提高任务完成率。**

[Pulse](https://arxiv.org/abs/2611.00988) 已经研究并使用强化学习优化执行中的记忆介入，因此不能把“使用独立记忆 Agent + GRPO”本身当成新贡献。CAMI 必须在约束表示、冲突消解、介入价值估计或执行前验证上提供增量证据。

## 十、如何设计消融实验？

为了避免模型更大、检索更多或消耗更多 Token 导致的混淆，我会固定基础模型、工具提供方、测试环境和预算，对比以下系统：

| 设置 | 目的 |
| --- | --- |
| ReAct + 普通 RAG | 基础个人任务执行能力 |
| ReAct + 结构化记忆 | 验证记忆组织是否有效 |
| 结构化记忆 + 时序状态更新 | 验证偏好变化处理 |
| 加入 Preference Compiler | 验证显式约束的作用 |
| 再加入规则式动态介入 | 验证执行中补充记忆 |
| 再加入学习型 CAMI | 验证介入时机优化 |
| 再加入主动策略 | 验证长期主动协助 |

我尤其关注四组难任务。

**偏好演化**：用户先提出一条偏好，数周后修改，系统是否仍错误使用旧记忆？

**跨应用长期任务**：邮件、日历、文件和浏览器之间存在依赖，且过程中会中断、失败和恢复。

**权限边界**：允许准备草稿却不允许发送，允许搜索但不允许购买。检查系统是否为了完成任务越权。

**过度个性化**：用户询问与其个人偏好无关的技术问题时，系统是否错误加入私人信息或不必要的个人设定？

需要独立报告：严格任务成功率、偏好约束满足率、错误使用旧偏好的比例、额外介入次数、有效介入的 Precision/Recall、主动通知有效性、权限违规率、平均成本以及多次重复执行的可靠性。

消融结果最好提供置信区间和成本—成功率曲线。只有证明 CAMI 的收益在相同或明确可比较的预算下成立，才能讨论其算法价值。

## 十一、如何避免只针对 Benchmark 过拟合？

针对 Benchmark 的优化应侧重通用失败机制，而不是硬编码某些数据来源、题目模板或常见答案。

例如系统不应该预先假设“找工作一定要去某个平台”，也不应该把某一网站的操作技巧当成 Personal Agent 的核心算法。工具技能可以提高具体来源的可访问性，但方法必须能够迁移到不同任务与服务。

我会采用三个检验：

第一，**用户隔离**：训练和测试使用不同用户画像及偏好组合，避免记住固定用户的答案。

第二，**任务与工具隔离**：测试集中加入训练时未见过的新工具或新任务类型，观察约束编译与动态介入是否仍可工作。

第三，**环境变化**：修改接口参数、日程内容和外部系统状态，避免系统通过重复固定轨迹获得高分。

此外，Benchmark 的隐藏评分标准应与 Agent 执行环境隔离；训练时可以使用公开的评价维度和自建测试规范，但不能假定线上执行能够访问隐藏参考答案。

## 十二、最小可行研究实现与真正的创新位置

如果开发资源有限，我会按以下顺序推进：

1. **建立基线**：单主 Agent、持久化任务状态、可重复模拟环境、最终状态验证。
2. **实现状态化记忆与 PPC**：支持来源、时间、范围、冲突更新以及硬软约束区分。
3. **实现 CAMI**：先规则式介入，再通过 SFT 学习判定。
4. **训练与消融**：重点比较仅在开始检索、每步检索、动态检索和动态检索加约束编译。
5. **扩展主动协助**：在已有可靠执行和权限边界后，训练 Notify / Ask / Act 的时机策略。

我的主要研究假设是：

> 在长期个人任务执行中，将带时间和情境信息的用户记忆编译为可执行约束，并在候选工具动作前进行选择性介入，能够减少偏好遗漏、过期偏好误用和无效交互，从而改善个性化任务成功率及成本效率。

这与简单“让 Agent 记更多内容”有明确区别，也能通过可控消融实验检验。

## 十三、面试中如何用三五句话讲清楚？

如果面试官要求立即说出最核心的洞察，我会这样回答：

> **我会把 Personal Agent 的核心问题定义为：如何让长期变化的用户状态真正影响执行决策。** 传统记忆系统往往只在任务开始时检索用户画像，但很多个人约束只有到具体工具调用前才变得关键，比如订票预算、会议时间偏好或发送授权。我会设计一个约束感知的动态记忆介入机制：先维护带时间和适用范围的用户状态，再监控候选动作，在关键节点注入相关记忆、编译约束并阻止错误执行。最后用真实环境状态验证任务完成，而不是只看模型是否生成了合理回答。**训练目标是用尽可能少的介入，减少因用户信息使用错误导致的失败。**

面对“这不还是给 Agent 加 Prompt 或 Skill 吗”的追问，关键澄清是：**这是一个可学习的运行时控制策略**，输入是当前任务状态、用户信念状态和候选动作，输出是是否介入及如何介入；它不依赖事先知道某个网站或给某种任务手工写死技能。

面对“为什么认为它能提升分数”的追问，则应直接说明实验：保持同一个基础模型与同样的工具和预算，对比普通 RAG、每步检索、规则介入与学习型介入；主要检查偏好变化任务的严格成功率、额外操作成本和硬约束违规情况。

## 参考资料

1. Wu et al. [LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory](https://arxiv.org/abs/2410.10813), ICLR 2025.
2. [PersonaAgent: Bridging Memory and Action for Personalized LLM Agents](https://aclanthology.org/2026.findings-acl.1315/), Findings of ACL 2026.
3. [Why Bother Me Again? Benchmarking Personal Agent Memory for Interaction Preferences](https://arxiv.org/abs/2610.30485), 2026.
4. [Pulse: Long-Horizon Tasks Need Streaming Personalization](https://arxiv.org/abs/2611.00988), 2026.
5. [VitaBench 2.0: Evaluating Personalized and Proactive Agents in Long-Term User Interactions](https://vitabench2.github.io/).
6. [《如何判断 Agent 真的完成了任务？从最终状态到过程级评测》](/research/how-to-evaluate-agent-task-completion/).
7. [《如何设计一个高分 Deep Research Agent？从动态规划、证据图到强化学习》](/research/designing-a-high-scoring-deep-research-agent/).
