---
title: "如何设计一个高分 Deep Research Agent？证据缺口、主动探索与动态研究策略"
description: "从 Agent 如何发现自己不知道什么出发，设计证据驱动的动态研究、探索与利用调度、结构化上下文、定向核验与强化学习研究策略，并讨论可复现评测。"
pubDate: 2026-11-18
tags: ["Agent 算法", "Deep Research", "Agent 评测", "强化学习", "信息检索"]
featured: false
draft: false
readingTime: "23 min read"
---

如果从头设计一个 Deep Research Agent，并希望它在公开测评中取得较高分数，我不会首先增加 Agent 数量、搜索轮数或报告篇幅，而会先解决一个核心问题：

**Agent 如何知道自己还不知道什么？找到信息之后，怎样判断下一步是继续搜索、换一个研究角度，还是验证并停止？**

我会将核心切入点放在 **Evidence-Gap-Driven Research（证据缺口驱动的研究）**：用一张持续更新的研究问题图和证据图记录当前“知道什么、证据是否足够、还缺什么”；通过有预算约束的探索—利用策略决定下一步行动；最后用独立核验判断能否交付。

这个切入点比“多搜索几次”“增加子 Agent”“做一套 Skills”更具体：它直接定义了**研究控制器究竟根据什么状态作出决策**。其落地机制包括 Rubric-Guided Research（任务要求）、Adaptive Planning（动态规划）、Evidence Graph（证据组织）和 Iterative Verification（定向修复），再通过监督学习或强化学习优化动作选择。

本文是一套**可供实现和实验验证的设计方案**，其中包含对已有工作的借鉴，也包含尚未验证的算法设想。文中的权重和调度公式是建议的研究起点，不应视为经过实验确定的最优设置。

## 一、先理解：不同 Deep Research Benchmark 在考什么？

Deep Research 至少包含两种不同的任务形态：一种要求生成资料充分、分析深入的长篇报告；另一种要求通过多跳检索找到难以定位的精确答案。它们需要的能力有交集，但不能直接使用相同的执行策略。

| Benchmark | 主要评测对象 | 设计时应该关注什么 |
| --- | --- | --- |
| [DeepResearch Bench](https://arxiv.org/abs/2506.11763) | 长篇研究报告；RACE 关注全面性、洞察深度、指令遵循与可读性；FACT 关注有效引用数量和引用准确性 | 信息覆盖、分析质量、可追溯引用 |
| [DeepResearch Bench II](https://arxiv.org/abs/2601.08536) | 132 个任务、22 个领域、共 9,430 条细粒度评价标准；维度包括信息召回、分析和呈现 | 减少关键事实遗漏，完成细粒度研究要求 |
| [BrowseComp](https://openai.com/index/browsecomp/) | 需要持续浏览、多步推理才能找到的难检索答案 | 搜索路径选择、候选排除、证据核验 |
| GAIA、xbench-DeepSearch 等 | 多步工具使用和信息搜索任务，具体评分协议各不相同 | 执行可靠性、工具选择、答案精确性 |

这意味着不能笼统地认为“报告越长，Deep Research 得分越高”。

面对报告型任务，系统需要系统性覆盖问题、综合资料并明确引用；面对精确问答型任务，继续扩写文章可能只会增加成本。**任务分类和评测协议应该影响研究策略，而不只是改变最终输出模板。**

也要区分公开的评测定义与评测时不可见的参考答案。系统可以借鉴评价维度生成自己的任务检查表，但不能假定能访问测试样本的隐藏 Rubric，更不能把测试参考报告当成在线研究材料。

## 二、整体架构：研究控制器 + 专业执行器 + 证据状态

我会采用一个负责决策的 Research Orchestrator，配合若干专注于搜索、分析和验证的执行模块。模块可以由同一个模型担任不同角色，也可以根据成本使用不同模型；并不要求一开始就部署很多独立的 Agent。

![Deep Research Agent 系统架构图：研究目标、研究控制器、搜索/分析/核查、证据图、质量审计与报告生成](/images/research/deep-research-agent-architecture.svg)

[查看或下载完整 SVG 架构图](/images/research/deep-research-agent-architecture.svg)

*图：研究执行结果写入证据库，审计器发现缺口后将修复任务反馈给 Research Orchestrator；通过检查后进行统一写作与引用核查。*

这里有三个需要刻意分开的职责。

**Orchestrator 管理研究状态。** 它决定研究节点的优先级、哪些节点能并行执行、何时需要反证，以及什么时候停止。它不负责替每个研究节点写长篇结果。

**Executor 负责具体研究。** Search Agent 查找来源、阅读原文并抽取证据；Analysis Agent 汇总与比较；Critic Agent 尝试寻找冲突事实或遗漏。执行结果必须以可追踪记录回写，不能只返回“已完成研究”。

**Auditor 负责独立判定。** 它检查研究覆盖与事实支持情况，对失败项提出可操作的修复请求。写作完成后，还需要对最终正文重新做一次引用级检查。

这与现有开源方案的方向一致。例如，[LangChain Open Deep Research](https://github.com/langchain-ai/open_deep_research) 采用 Supervisor–Researcher 架构，并让最终报告由统一阶段完成；[NVIDIA AI-Q Deep Researcher](https://docs.nvidia.com/aiq-blueprint/2.1.0/architecture/agents/deep-researcher.html) 采用 Orchestrator、Planner、Researcher 等角色协作；[DuMate-DeepResearch](https://arxiv.org/abs/2606.07299) 则讨论了动态研究图、递归搜索和 Rubric 指导。

我会进一步将研究过程中的“任务缺口”和“证据缺口”显式表示出来，让调度器有结构化依据。

### ReAct 与 Plan-and-Execute 应该如何结合？

我不会将 ReAct 和 Plan-and-Execute 简单地视为二选一。ReAct 的优势是能够根据刚刚获得的观察及时决定下一步动作，但也可能沿着近期搜索结果反复深入，形成局部搜索偏好；一次性 Plan-and-Execute 便于保证结构化覆盖，却可能因为计划过早固定而遗漏新线索。

更合理的组织方式是 **粗粒度研究规划 + 节点内 ReAct 式探索 + 节点完成后的全局重规划**：Orchestrator 负责“研究什么、当前优先处理什么”，节点执行器负责“如何在本问题下使用工具”，Auditor 负责“获得的证据是否足以改变研究状态”。

对固定且可程序化的子步骤，例如去重、时间换算或运行统计脚本，直接使用确定性程序。只有存在多种合理研究路径、必须根据新信息决策时，才调用模型。这样才能将自主规划用在真正需要判断的部分。

## 三、Rubric-Guided Task Decomposition：先把任务变得可检查

考虑一个问题：

> 对比主流 Coding Agent 的系统架构、工具调用机制、长程任务能力、公开 Benchmark 表现及局限。

直接要求 Agent “进行深入研究”太含糊。我会先构造内部 Research Brief：

| 研究维度 | 可以检查的具体问题 |
| --- | --- |
| 研究对象覆盖 | 是否选取具有代表性的系统？是否记录产品或代码版本？ |
| 系统架构 | 是否描述运行时、状态管理、工具调用和任务调度？ |
| 评测结果 | 是否注明 Benchmark 版本、测试设置、预算和结果出处？ |
| 对比分析 | 不同设计带来的性能、可靠性和成本差异是否有证据？ |
| 局限性 | 是否考虑失败案例、不可比实验和未知项？ |

每条要求再拆成原子检查项。例如“正确比较评测结果”至少包含：

- 找到原始评测报告，识别任务数量、测试集和统计口径；
- 区分官方报告、第三方复测与社区转述；
- 判断不同模型、版本和预算下的结果是否具有可比性；
- 缺乏数据时明确说明，而不编造统一排行榜。

每个检查项保存 **重要性、完成状态、证据引用、未解决问题和依赖任务**。

研究要求也需要动态扩展。假设执行过程中发现两个 Coding Agent 使用不同版本的 SWE-bench，那么应该新增“核实评测版本差异”的任务节点。新增节点不能无限膨胀，需要由用户需求、预期增益和预算共同限制。

这里的 Rubric 是系统自己为当前任务创建的研究规范；它与 Benchmark 官方用于最终打分的 Rubric 不是同一对象。任务检查表即使全部勾选，也可能没有覆盖某个研究者尚未意识到的重要维度，这就是后续需要主动探索的原因。

为了降低这种风险，我会从**任务结构**和**来源结构**两条路径构造覆盖框架：前者包括问题涉及的对象、时间范围、研究方法、对照变量和反例；后者检查官方资料、原始论文、独立复测与批评性来源是否存在结构性缺失。框架只是寻找盲区的线索，不能保证枚举全部未知问题。

## 四、Evidence Graph：让检索结果成为可核验的事实

Deep Research 的一个常见问题是：搜索 Agent 给出整段摘要，后续模型只记住结论，却找不到原文来自哪里。经过多次压缩之后，引用可能只剩下网址，具体主张却已无法核实。

因此我会将搜索结果存成**原子主张（Claim）+ 原文证据片段（Evidence Span）+ 来源元数据**。

~~~python
evidence = {
    "claim_id": "claim_017",
    "claim": "某系统在指定评测设置下报告了某项结果",
    "source_url": "https://example.org/original-paper",
    "source_span": "原文中与该主张对应的片段",
    "source_type": "primary_paper",
    "published_at": "YYYY-MM-DD",
    "retrieved_at": "YYYY-MM-DD",
    "benchmark_version": "具体版本或未知",
    "stance": "supports",
    "rubric_ids": ["eval_02", "eval_03"],
    "verified": False
}
~~~

这是一种建议的数据结构，不对应某个公开框架的固定 API。

我会保留以下关系：

- **supports**：证据支持某项主张；
- **contradicts**：证据反驳或与主张冲突；
- **depends_on**：某个结论依赖另一项事实或假设；
- **derived_from**：多个来源实际上复述同一原始资料。

例如，三篇博客都引用一份官方评测，并不意味着存在三个独立证据。系统应对转载和引用链去重，尽可能定位最初的数据或实验报告。

同时，**来源可信度、主张支持程度和结论置信度需要分开表示**。官方网站可能准确描述自己的配置，但其营销性结论仍然可能缺少充分比较；一篇真实论文也可能被错误引用。

事实核验最好使用能定位原文片段的工具和结构化约束：链接是否能打开、片段是否确实包含主张、数值和单位是否一致、时间范围是否匹配。LLM 判定可以参与难以程序化的语义支持判断，但不应成为唯一依据。

### Context Engineering：保存研究状态，按需取回证据

上下文管理是研究策略的基础设施。长程搜索不断积累网页、摘要和中间推理，如果只靠无差别截断或压缩，系统可能忘记原始出处，也可能将不可靠的中间推测当成事实。

我会将证据图与研究状态持久化在上下文之外；每轮决策只取回当前任务相关的研究要求、未完成节点、可信证据、冲突项与剩余预算。原始来源片段不因摘要生成而被覆盖，而是在需要核查时按来源 ID 重新读取。研究控制器看到的是紧凑的决策状态，写作或审计模块则可以追溯完整材料。

**Skills 和信息入口适配器是可选能力，而不是通用研究能力的前提。** 系统可以在需要时选择搜索 API、学术检索、网页浏览或合法授权的数据接口。针对某个平台的 Skills 能提高特定来源的可用性，但即使没有预写的站点技能，研究控制器仍应能够尝试其他可访问来源、说明访问限制，并继续执行任务。

## 五、Adaptive Planning：根据证据动态扩展研究 DAG

固定 Plan-and-Execute 往往假设一开始就知道完整研究路径。但深入研究中，新发现会不断改变原来的问题结构。

我会把任务表示为有向无环图（DAG）：节点对应子研究目标，边表示依赖关系。对于每个节点保存：

~~~python
research_node = {
    "id": "eval_comparison",
    "question": "两项评测结果是否可直接比较？",
    "dependencies": ["benchmark_a", "benchmark_b"],
    "status": "needs_verification",
    "importance": 0.8,
    "uncertainty": 0.6,
    "evidence_ids": ["claim_017", "claim_021"],
    "estimated_cost": 3.0
}
~~~

此处的分数只是演示字段，并非真实测量结果。

执行一个节点后，Orchestrator 不仅看“是否完成”，还要分析是否发现了新的冲突、重要信息缺口或条件依赖。例如，在对比两款 Agent 时发现其工具使用预算相差数倍，就应追加关于预算可比性的研究，而不是继续机械执行原计划。

[DAGent: Evaluate-then-Grow Planning for Deep Research Agents](https://arxiv.org/abs/2609.39154) 提出增量式 DAG 规划：先执行并评估已有节点，再依据完成节点的置信度与不确定性扩展研究图。这个思路是我设计中的直接参考。

### 真正难的部分：发现 Unknown Unknowns（未知的未知）

证据缺口至少有两种。

**已知缺口（Known Gaps）**：Agent 已经知道某个问题需要回答，却没有足够证据。例如某模型的成功率有出处，但缺少评测预算和数据集版本。此时可以进行精确的定向补缺。

**未知盲区（Unknown Unknowns）**：Agent 甚至尚未把某项因素列入研究图。例如只比较两个 Coding Agent 的成功率，没有意识到它们在仓库初始化状态、工具访问权限或人工介入规则上存在差异。只反复查询既有子问题，往往发现不了这类遗漏。

未知盲区无法直接计算“还有多少”。我会引入几个可执行的**发现机会**：从不同立场和来源重新检索同一主题；用反向假设搜索可能推翻现有结论的证据；对照任务分类表查找尚未研究的维度；针对异常数值与不一致描述追踪前提条件；将新发现与已有研究图比较，判断是否需要新增节点。

这类似对研究空间进行覆盖采样和主动证伪。它只能提高发现遗漏的机会，**不能声称已经穷尽所有未知知识**。同时，要防止无关的“新奇发现”被奖励：新节点必须与用户目标有明确关系，并通过至少一次来源核验，才能计入有效研究进展。

### 用预期研究收益选择下一步动作

我会为每个候选动作估计质量提升和执行成本：

$$
a_t^*=\arg\max_{a\in\mathcal A(s_t)}
\frac{\mathbb E[\Delta Q(a)\mid s_t]}
{\lambda_c C(a)+\lambda_t T(a)+\varepsilon}
$$

其中，$a$ 可以是新增搜索、阅读论文、验证矛盾或对某个节点进行深入分析；$\Delta Q$ 是预期质量增益，$C$ 是调用成本，$T$ 是时间开销。

预期质量增益可以近似为：

$$
\widehat{\Delta Q}(a)=
w_1\Delta \mathrm{Coverage}
+w_2\Delta \mathrm{Evidence}
+w_3\Delta \mathrm{ConflictResolution}
+w_4\Delta \mathrm{Analysis}
+w_5\Delta \mathrm{Discovery}
$

其中 $\Delta\mathrm{Discovery}$ 表示发现**与研究目标相关且可核验的新问题或证据维度**所带来的潜在价值；它与已知 Rubric 的覆盖增量不同。该值只是一种估计，不能直接将“产生更多问题”当成奖励。

这不是已知真实质量增益，而是一个可训练、可校准的**动作价值预测器**。初版可以由规则和评分模型估计；积累轨迹后，再用历史动作与最终质量提升学习预测。对“新发现”还应增加重复来源去重和相关性惩罚，避免系统为追求新颖而偏离任务。

### 探索—利用调度：既补缺，又避免局部搜索陷阱

如果始终选当前估计收益最高的动作，系统可能重复调查熟悉方向。为此，我会把候选动作分为三类：**Exploitation（定向补缺）**负责处理已知高价值缺口；**Exploration（主动发现）**负责寻找新维度、新来源与反面材料；**Verification（定向核验）**负责解决已有证据冲突。

调度器按照剩余预算、研究阶段和未覆盖风险动态调整三类动作的占比，而不是给所有任务写死相同的搜索比例。例如研究初期可以进行更广泛的多路径采样；核心结构稳定后优先解决关键缺口；写作前更多地处理高风险主张。也可以先用简单的带约束启发式策略实现，再比较上下文多臂赌博机或学习型策略是否真正改进结果。

特别要防止探索退化成“在 Google 上换几个同义词”。有效探索应有不同的**研究假设、来源类别或验证目标**，并检查它是否产生了可追溯的新信息。重复搜索但没有任何有效进展时，应衰减该路径的优先级。

还要加入硬约束：必须验证的事实即使成本较高，也不能因短期收益偏低而被无限延后；独立搜索节点可并行，有依赖的节点需要等待前置证据。

### 一个从发现问题到修正研究图的例子

假设用户要求比较两款 Coding Agent 的长程任务能力：

| 研究步骤 | 新观察 | 系统下一步 |
| --- | --- | --- |
| 初始规划 | 两款系统都公布了成功率 | 建立“结果、测试集、执行预算、任务类型”四组基本节点 |
| 定向补缺 | 找到成功率，但其中一款缺少工具调用预算 | 精确搜索原始评测设置，记录尚未查明的字段 |
| 主动探索 | 独立复测指出两款系统的环境初始化方式不同 | 新增“初始化状态可比性”节点，检查结论是否需要限定 |
| 交叉核验 | 两份来源采用不同的数据集版本 | 取消直接排名，分版本呈现结果并解释不可比原因 |
| 交付检查 | 核心差异已有来源支持，但部分成本数据缺失 | 明确标注未知数据，避免凭推测下成本结论 |

这个例子的数值和来源关系是假设的，目的是展示研究控制机制。关键是：**研究图会因为新证据改变，不能只在初始计划上完成打勾。**

### 何时停止？

“模型认为研究充分”不是可靠的停止标准。我会设置以下条件共同决定：

1. 必需研究要求已经覆盖，或者明确标记无法获得证据的部分；
2. 关键结论存在足够直接、可核验的来源支持；
3. 主要矛盾已解决，剩余分歧已在报告中透明呈现；
4. 新增研究动作的预期边际收益低于成本阈值，或已达到预算上限。

停止是成本与质量的决策，不能把“预算耗尽”误判成“研究已完成”。预算耗尽时仍可交付带有局限性说明的部分报告。

## 六、报告生成：从证据出发，而不是从段落出发

最终写作应该遵循 **Outline → Evidence Binding → Synthesis → Citation Audit**。

首先依据任务 Rubric 生成报告大纲。每个章节关联研究节点和证据集合。然后汇总能够支持的事实、竞争性解释和未解决的问题，再进行行文组织。

我会明确区分：

**事实**：来源直接陈述或通过确定性计算得出的信息。

**分析**：在多个事实基础上推导的解释或比较，应明确其依据与适用条件。

**假设**：目前尚无足够证据验证、但对进一步研究有价值的推测。

生成完报告后，Citation Auditor 将每个关键句拆成可核查的原子主张。比如：

> “模型 A 取得 78% 的成功率，显著优于模型 B，且成本更低。”

这句话至少涉及三项检查：78% 是否有原始结果支持；两者评测是否可比；“显著优于”是否经过相应统计验证。若某一项无法成立，应修改为证据允许的更窄表述，而不是简单补一个引用。

对于计算结果、代码分析和数据表格，还可以使用可执行验证器；对于开放性解释，结合原始资料进行审阅。失败报告应包含**具体主张、失败原因及建议修复动作**，回传给 Orchestrator。

例如核验器可以返回如下结构化结果：

~~~json
{
  "claim_id": "claim_017",
  "status": "insufficient_support",
  "reason": "引用只提供了成功率，未说明测试集版本和工具调用预算",
  "repair_action": "search_original_evaluation_protocol",
  "target_node": "eval_comparison",
  "retry_limit": 2
}
~~~

运行时据此创建一个明确的研究任务，而不是简单要求 Writer“再写一遍”。如果复查后依然没有可信证据，就缩小结论范围或说明限制；对同一失败项设置重试上限并记录已尝试的检索路径，避免修复循环耗尽预算。

这与 [《如何判断 Agent 是否完成任务？》](/research/how-to-evaluate-agent-task-completion/) 中区分停止条件和任务成功条件的原则是一致的。

## 七、算法研究：把研究控制策略建模为序贯决策

如果希望在此基础上形成可发表的算法研究，我会优先训练**研究控制器**，而不是对所有 Agent 进行没有区分的端到端强化学习。

研究环境具有部分可观测性：系统只能看到已检索到的网页、已执行的工具结果和当前证据图，无法直接知道互联网上所有潜在资料。因此可以用 POMDP 的思想描述，并在实现中维护一个近似的研究状态。

$$
s_t=(q,\rho_t,G_t,E_t,B_t,H_t,D_t)
$$

其中，$q$ 表示用户任务，$\rho_t$ 表示研究要求的完成情况，$G_t$ 是研究图，$E_t$ 是证据集合，$B_t$ 是剩余预算，$H_t$ 是执行历史摘要，$D_t$ 表示来源多样性、尚未覆盖的研究维度和探索进展摘要。$D_t$ 只描述**可观察的探索信号**，不意味着系统掌握了所有未知问题。

动作集合包括：

$$
\mathcal A=\{\mathrm{search},\mathrm{explore},\mathrm{read},\mathrm{expand},\mathrm{verify},\mathrm{analyze},\mathrm{write},\mathrm{stop}\}
$$

策略 $\pi_\theta(a_t\mid s_t)$ 负责选择下一步研究动作。它也可以输出具体的检索查询、研究节点或待验证主张，而不是只有离散动作类型。

### 设计多目标奖励

一个实验起点是：

$$
R=0.30R_{\mathrm{coverage}}
+0.25R_{\mathrm{factuality}}
+0.20R_{\mathrm{analysis}}
+0.15R_{\mathrm{citation}}
+0.10R_{\mathrm{instruction}}
-\lambda C
$$

以上系数仅用于展示训练目标的结构，真正实施时需要进行敏感性分析。对于精确问答型 Benchmark，分析深度和长报告质量的权重可能需要降到很低；对于报告型 Benchmark，引用质量及全面性可能更加重要。

必须防止错误的代理奖励。例如，仅奖励“引用数量”会鼓励堆砌无关网址；仅奖励“Rubric 命中条数”可能让模型照搬条目却缺乏综合分析；仅奖励长篇输出可能损害正确性和效率。

因此，我会将可程序核查的指标与独立模型评审结合，并对关键事实进行人工抽样检查。特别对于主动探索，不能直接奖励“新节点数量”，而应检查这些节点是否与任务相关、是否由独立来源支持，以及是否确实改变了可验证结论。

### 更难的问题：研究轨迹的 Credit Assignment

假设 Agent 执行 30 次检索，最终只有少数检索找到了实质性证据。如果所有动作仅接收相同终局奖励，控制器很难判断哪些搜索策略值得保留。

我会尝试三种信号：

- **证据增量**：该动作带来了多少新的、独立且经过核验的关键证据；
- **研究状态变化**：该动作消除了多少必需任务缺口或实质性矛盾；
- **反事实贡献**：从最终证据集合移除某项研究结果后，报告质量是否下降。

第三种最接近因果贡献，但重新生成报告开销大，可以只对高价值节点抽样估计。

[DAGent](https://arxiv.org/abs/2609.39154) 同时提出 DAGRPO，利用 DAG 结构为 Executor 的 rollout 分配与拓扑有关的奖励信号，并对 Orchestrator 的规划施加结构约束。其公开论文报告，在指定 Qwen3-8B 实验设置中，相对于同预算 GRPO 获得了更高的平均 Pass@1。它证明结构化信用分配值得进一步研究，但不代表上述 Evidence Graph 奖励设计已经得到同等验证。

训练路线可以先采用高质量轨迹的 SFT，使模型学会研究动作协议与状态更新；再用 GRPO、PPO 或其他策略优化方法训练动作选择。不同轨迹比较应尽量共享相同初始任务、可访问来源快照和预算，否则网络内容变化会混入奖励差异。

## 八、核心执行循环：一个可实现的伪代码

~~~python
def deep_research(question, budget):
    # 以下是机制性伪代码，函数与接口需要自行实现。
    state = initialize_research_state(question, budget)
    state.rubrics = derive_task_rubrics(question)
    state.graph = create_initial_research_dag(state.rubrics)

    while state.budget.remaining > 0:
        audit = audit_coverage_and_evidence(state)
        blindspots = propose_missing_dimensions(
            question, state.graph, state.evidence, state.source_diversity
        )

        if should_stop(audit, blindspots, state.budget):
            break

        # 定向补缺、主动探索、冲突核验都进入候选集。
        candidates = propose_targeted_actions(state, audit)
        candidates += propose_exploration_actions(state, blindspots)
        candidates += propose_verification_actions(state, audit.conflicts)

        action = select_budget_aware_action(
            candidates,
            state,
            exploration_policy="adaptive"
        )
        result = execute_in_sandbox(action)
        extracted = extract_claims_with_source_spans(result)

        state.evidence.add_and_deduplicate(extracted)
        state.graph.update_from_result(action, extracted)
        state.source_diversity.update(result.sources)
        state.budget.record(result.cost)
        state.history.append(action, result)

    report = synthesize_report(state.rubrics, state.evidence)
    issues = audit_claim_to_source(report, state.evidence)

    # 审计器返回具体的修复任务，修复过程也有统一预算和上限。
    report = repair_specific_issues_with_budget(
        report, issues, state, max_retries_per_issue=2
    )
    return final_audit_and_export(report, state)
~~~

这是一段表达执行逻辑的伪代码，省略了持久化、工具异常、任务并发、重试、Token 计费和实际模型调用。真实实现还应控制提示注入：网页正文属于不可信内容，不能直接改变系统工具权限或研究目标。

为避免无限循环，修复阶段也必须遵守统一预算，并限制无有效进展的重复检索。

## 九、如何设计实验，判断方案是否真的提高分数？

一套机制是否有用，不能只看它输出了更完整的示例报告。我会做两组实验：一组检验最终表现，另一组检验每个模块的独立贡献。

### 对照组与消融实验

| 实验设置 | 研究目的 |
| --- | --- |
| ReAct + Search + Writer | 基础工具使用能力 |
| 固定 Plan-and-Execute | 验证静态规划的效果 |
| Supervisor + 并行 Researcher | 评估多 Agent 分工 |
| 动态 DAG | 检验按证据更新规划的价值 |
| 动态 DAG + Evidence Graph | 检验结构化证据管理能否提升事实与引用质量 |
| 加入主动探索与反证搜索 | 检验是否能够发现初始规划之外的重要研究维度 |
| 加入探索—利用调度 | 与纯贪心搜索、固定探索配额比较预算效率 |
| 再加入 Citation Auditor 与定向修复 | 比较直接重写和失败原因驱动修复的效果 |
| 持久化证据状态与按需检索 | 检验长程任务中的事实丢失与上下文成本 |
| 再加入学习型调度策略 | 检验 SFT/RL 是否优于启发式动作选择 |

所有组尽量使用相同的基础模型、搜索提供方、检索结果快照和预算上限，避免把“大模型更强”“搜索次数更多”错误解释为算法改进。

### 需要记录什么？

对报告型研究任务，我会记录：Rubric 覆盖率、事实正确率、有效引用率、分析质量、指令遵循、Token 成本、工具调用次数、总耗时以及人工抽检结果。

**针对未知盲区，单靠 Agent 自己生成的 Rubric 覆盖率是不够的。** 我会另设不向被测 Agent 暴露的人工研究维度和事实清单，评估它是否发现初始计划之外的关键因素；同时对新发现做相关性核查，避免无意义地增加研究节点。可以设置刻意隐藏重要对照条件、来源之间有冲突、只给部分初始证据等压力测试，但这类定制实验结果需要与正式 Benchmark 分开报告。

对 BrowseComp 这类精确问答任务，应额外关注 Pass@1、答案可验证性、有效搜索路径长度和失败恢复次数。

我尤其希望绘制三条关系曲线：

1. **任务得分 — 搜索调用次数**：是否更快找到有价值的资料；
2. **任务得分 — Token/时间成本**：同等资源下是否更强；
3. **事实正确率 — 有效证据覆盖率**：证据积累是否真正转化为答案质量。

还应报告不同随机种子或重复运行下的均值、波动和置信区间。报告型 LLM-as-a-Judge 有模型偏好与措辞敏感性，最好用独立裁判和人工样本复核。

**公开测试集适合最终评估，不能反复用测试集挑提示词和奖励权重。** 训练、开发与测试应严格隔离；已有论文或代码库中出现的测试参考答案也需要进行数据污染检查。

## 十、实际开发顺序：先验证系统，再训练算法

我会分三个阶段实现。

**V1：可靠工程基线。** 先实现任务解析、搜索、来源去重、证据存储、统一写作和引用审计。每次执行保存研究轨迹与具体失败原因，建立可复现的 Benchmark 运行脚本。已有项目 [Open Deep Research](https://github.com/langchain-ai/open_deep_research) 可作为参考。

**V2：证据感知的动态调度。** 加入研究 DAG、Rubric 覆盖状态、冲突识别、主动探索候选与探索—利用调度，并实现候选动作价值估计。先用简单启发式方法实现，再与固定规划方法进行同预算比较。如果这一阶段没有提升，应先定位证据抽取或价值估计的问题，而不是直接引入强化学习。

**V3：学习型 Research Policy。** 从 V1/V2 的成功与失败轨迹构造训练数据，使用 SFT 学习工具与研究动作协议，再尝试面向研究状态的策略优化和结构化信用分配。训练模型必须与未经训练的同架构版本进行对照。

对个人或小团队项目而言，最有价值的第一项实验很可能是：**在相同搜索预算下，“基于证据缺口的下一步搜索选择”能否提高最终报告的事实覆盖和引用正确率？** 这个问题足够具体，也能独立于大规模强化学习验证。

## 十一、我会如何定义算法贡献？

如果进一步整理为研究论文，我会暂时将核心方案称为：

**Evidence-Aware Adaptive Research Policy：证据感知的自适应研究策略。**

其研究问题可以表述为：

> 在不完整信息和有限工具预算下，Agent 如何基于现有证据、任务缺口与研究图结构，选择最有价值的下一项研究动作，并在适当时机终止探索？

我会提出四个待验证假设：

**H1：** 与一次性静态规划相比，证据驱动的动态 DAG 能在相同预算下提高关键事实覆盖率。

**H2：** 与纯终局奖励相比，加入证据增量与研究图依赖关系的信用分配能改善策略训练的样本效率。

**H3：** 与固定最大搜索轮数相比，基于边际质量增益的停止策略能在相近任务质量下减少调用成本。

**H4：** 与只根据已知 Rubric 缺口搜索的策略相比，包含反向假设和跨来源主动探索的策略能更好地发现初始规划之外的关键条件，且不会显著增加无关信息。

这里需要谨慎区分创新点与已有工作。动态研究 DAG、Rubric 指导、结构化信用分配本身均已有相关研究。真正可能形成贡献的部分，是**把已知证据缺口和未知盲区的发现机会统一纳入预算敏感的动作价值估计，并证明它能改善跨任务、跨预算的研究决策**。若没有充分的消融与泛化实验，这仍然只是系统设计设想。

## 十二、总结

我会把 Deep Research Agent 的设计归结为一个问题：**Agent 如何持续发现自己还不知道什么，并用有限预算获取足以支撑结论的证据？** 具体机制是任务要求与证据图、未知盲区的主动发现、探索—利用调度，以及根据核验结果生成修复动作。

对于报告型任务，这些机制主要帮助提升覆盖率、分析深度与引用质量；对于精确搜索任务，则应减少不必要的写作，将预算投入检索、候选排除和答案核验。

从算法研究角度，最值得进一步探索的是如何学习一个可靠、预算敏感、既能定向补缺又能主动寻找未知研究维度的 **Research Policy**。它是否真正有效，最终仍取决于严格的同预算对照实验。

## 参考资料

1. Du et al. [DeepResearch Bench: A Comprehensive Benchmark for Deep Research Agents](https://arxiv.org/abs/2506.11763), 2025；[项目主页](https://deepresearch-bench.github.io/)。
2. [DeepResearch Bench II: Diagnosing Deep Research Agents via Rubrics from Expert Reports](https://arxiv.org/abs/2601.08536), 2026；[项目主页](https://agentresearchlab.com/benchmarks/deepresearch-bench-ii/)。
3. OpenAI. [BrowseComp: A Benchmark for Browsing Agents](https://openai.com/index/browsecomp/), 2025。
4. [DuMate-DeepResearch: An Auditable Multi-Agent System with Recursive Search and Rubric-Grounded Reasoning](https://arxiv.org/abs/2606.07299), 2026。
5. Liu et al. [DAGent: Evaluate-then-Grow Planning for Deep Research Agents](https://arxiv.org/abs/2609.39154), 2026；[开源代码](https://github.com/hanwenliu6825/DAGent)。
6. LangChain. [Open Deep Research](https://github.com/langchain-ai/open_deep_research)；[设计说明](https://www.langchain.com/blog/open-deep-research)。
7. NVIDIA. [Deep Researcher Agent — AI-Q Blueprint](https://docs.nvidia.com/aiq-blueprint/2.1.0/architecture/agents/deep-researcher.html)。
