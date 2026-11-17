---
title: "GRPO 与 PPO 的区别"
description: "从优势估计、裁剪目标、Critic、采样成本和奖励设计理解 PPO 与 GRPO，并讨论它们在 LLM Agent 强化学习中的适用场景。"
pubDate: 2026-11-18
tags: ["Agent 算法", "Agent", "强化学习", "PPO", "GRPO", "大语言模型"]
featured: false
draft: false
readingTime: "12 min read"
---

在大语言模型强化学习（RL）中，PPO（Proximal Policy Optimization，近端策略优化）和 GRPO（Group Relative Policy Optimization，组相对策略优化）经常被放在一起讨论。GRPO 最初发表于 [DeepSeekMath（2024）](https://arxiv.org/abs/2402.03300)，后来也被用于 [DeepSeek-R1](https://www.nature.com/articles/s41586-025-09422-z) 的推理能力训练。

**两者最关键的区别是优势函数（Advantage）的估计方式。** 典型 Actor-Critic PPO 借助价值网络（Critic）估计动作相对预期表现有多好；GRPO 直接比较同一问题的多个采样回答，利用组内相对奖励估计优势，因此不需要单独训练 Critic。

GRPO 仍然保留了 PPO 的策略比率与裁剪思想。理解这层关系后，就能进一步分析：为什么 GRPO 适合数学、代码等可验证任务？去掉 Critic 是否一定更省资源？训练多步工具调用 Agent 时，又会遇到哪些问题？

## 一、先看整体对比

| 维度 | PPO（典型 Actor-Critic 实现） | GRPO（原始结果监督形式） |
| --- | --- | --- |
| 核心优化 | 裁剪策略梯度目标 | 保留 PPO 风格的裁剪目标 |
| 优势估计 | 价值函数，常结合 GAE | 同一个问题的一组回答的相对奖励 |
| Critic | 通常单独训练 | 不需要单独训练 |
| 采样单位 | 环境轨迹及其时间步 | 每个 Prompt 的多条回答 |
| 奖励形式 | 可利用逐步与终局奖励 | 原始结果监督使用回答级奖励 |
| 训练负担 | 价值网络训练、存储和估值 | 一题多次生成、奖励计算和策略更新 |
| 常见场景 | 控制、游戏、机器人、LLM RLHF | 大模型推理、代码、可验证答案的任务 |

有两个概念需要提前澄清。

首先，**PPO 的数学定义并不强制使用 Critic**。PPO-Clip 主要定义如何限制策略更新；Actor-Critic 加 GAE 是常见实现。GRPO 则提供一种特别适合组内比较的优势估计方案。

其次，**GRPO 不等于不需要奖励模型**。GRPO 取消的是价值模型。奖励仍然可能来自规则验证器、测试结果、奖励模型或人工构造的评分函数。

## 二、PPO：利用价值函数估计优势

PPO 的目标是提高优于预期的动作概率，降低劣于预期的动作概率，同时避免策略在一次更新中变化过大。

设当前策略为 $\pi_\theta$，产生训练样本的旧策略为 $\pi_{\theta_{\mathrm{old}}}$。在状态 $s_t$ 下，已采样动作 $a_t$ 的概率比率为：

$$
\rho_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}{\pi_{\theta_{\mathrm{old}}}(a_t\mid s_t)}
$$

PPO-Clip 的核心目标是：

$$
J_{\mathrm{PPO}}(\theta)=\mathbb{E}_t\left[\min\left(\rho_t(\theta)\hat A_t,\operatorname{clip}(\rho_t(\theta),1-\epsilon,1+\epsilon)\hat A_t\right)\right]
$$

其中，$\hat A_t$ 为优势估计，$\epsilon$ 是裁剪阈值。正优势动作倾向于被强化，负优势动作倾向于被抑制。Clipping 会削弱过大策略变化带来的额外目标收益，但**它不是策略变化或 KL 散度的绝对硬约束**。

典型 Actor-Critic PPO 通过价值函数 $V_\psi(s_t)$ 预测从状态 $s_t$ 出发的预期回报，再利用广义优势估计（GAE）构造：

$$
\delta_t=r_t+\gamma V_\psi(s_{t+1})-V_\psi(s_t)
$$

$$
\hat A_t^{\mathrm{GAE}}=\sum_{l=0}^{T-t-1}(\gamma\lambda)^l\delta_{t+l}
$$

这里 $\gamma$ 是折扣因子，$\lambda$ 控制估计的偏差与方差。实际训练往往还包含价值损失、熵正则及可选的 KL 控制项，具体取决于实现。

这种方法适合多阶段的状态—动作决策：例如无人机在每个时间步根据位置、电量和任务状态选择动作，并通过价值函数估计后续收益。转向大语言模型时，价值网络通常较大，且需要对大量序列位置估值，给显存、计算和训练稳定性带来额外负担。

## 三、GRPO：用一组回答进行相对比较

GRPO 改变了上述优势估计步骤。

给定同一个问题 $q$，旧策略一次采样 $G$ 个回答：

$$
o_1,o_2,\ldots,o_G\sim\pi_{\theta_{\mathrm{old}}}(\cdot\mid q)
$$

为这些回答分别计算奖励 $R_1,\ldots,R_G$。在 [DeepSeekMath](https://arxiv.org/abs/2402.03300) 的结果监督（Outcome Supervision）版本中，使用组内均值和标准差计算相对优势：

$$
\mu_R=\frac{1}{G}\sum_{i=1}^{G}R_i,\qquad \sigma_R=\operatorname{std}(R_1,\ldots,R_G)
$$

$$
\hat A_i=\frac{R_i-\mu_R}{\sigma_R}
$$

实现时应处理 $\sigma_R=0$，通常加入数值稳定项或对无区分度的组作特殊处理。原始结果监督版本中，同一个回答的所有生成 Token 共享该回答的相对优势。

例如，对一道数学题生成四个回答，正确记 1 分，错误记 0 分：

$$
\mathbf R=[1,1,0,0]
$$

如果按总体标准差计算，均值为 $0.5$，标准差为 $0.5$，于是：

$$
\hat{\mathbf A}=[1,1,-1,-1]
$$

两条正确回答得到正优势，两条错误回答得到负优势。GRPO 无须训练额外网络预测“这一题的价值是多少”，只要根据同组的相对结果构造更新方向。

不过，这也暴露了一个重要限制：如果四条回答**全部正确或全部错误**，组内奖励方差为零，那么原始相对奖励就无法区分好坏，策略梯度的奖励信号可能消失。对难题而言，采样组中始终没有成功解，会限制这种训练方式的效果。

## 四、GRPO 如何继承 PPO 的裁剪目标？

GRPO 没有丢掉 PPO 的核心更新思路。对回答 $o_i$ 的第 $t$ 个生成 Token，定义：

$$
\rho_{i,t}(\theta)=\frac{\pi_\theta(o_{i,t}\mid q,o_{i,<t})}{\pi_{\theta_{\mathrm{old}}}(o_{i,t}\mid q,o_{i,<t})}
$$

为简化表达，先定义裁剪项：

$$
f(\rho,A)=\min\left(\rho A,\operatorname{clip}(\rho,1-\epsilon,1+\epsilon)A\right)
$$

则原始 GRPO 的结果监督目标可以写作：

$$
J_{\mathrm{GRPO}}(\theta)=\mathbb{E}\left[\frac{1}{G}\sum_{i=1}^{G}\frac{1}{|o_i|}\sum_{t=1}^{|o_i|}\left(f(\rho_{i,t}(\theta),\hat A_i)-\beta D_{\mathrm{KL},i,t}\right)\right]
$$

这里 $|o_i|$ 是回答长度，$\beta$ 控制相对于参考策略的 KL 惩罚。在原论文的实现中，使用基于 Token 概率比率的 KL 估计。后续训练框架可能修改 KL 项、长度归一化或优势标准化方式，因此不能将这个式子视为所有 GRPO 变体的唯一实现。

还要区分两个常被混淆的策略：

- **旧策略 $\pi_{\theta_{\mathrm{old}}}$**：负责生成当前样本，分母中的旧对数概率常通过缓存保存。
- **参考策略 $\pi_{\mathrm{ref}}$**：提供 KL 约束的参考分布，通常固定在某个先前的模型版本。

Clipping 主要作用于当前策略与**采样旧策略**之间的比率；KL 正则化可以约束当前策略相对于**参考模型**的偏离。GRPO 省去 Critic，并不意味着其训练完全不需要其他模型副本、缓存或额外前向计算。

## 五、训练流程对比

\`\`\`mermaid
flowchart TD
    A["训练任务 / Prompt"] --> B["典型 PPO"]
    A --> C["原始 GRPO"]
    B --> D["采样轨迹与奖励"]
    D --> E["Critic 预测价值"]
    E --> F["GAE 估计优势"]
    F --> G["裁剪策略更新"]
    C --> H["同题采样 G 个回答"]
    H --> I["对回答评分"]
    I --> J["组内相对优势"]
    J --> K["裁剪策略更新"]
    G --> L["进入下一轮采样"]
    K --> L
\`\`\`

*图：两条路径共享裁剪策略优化，但用于计算优势的信息不同。*

下面是一段帮助理解 GRPO 的简化伪代码。它只演示奖励到策略损失的核心过程，真实训练还需处理有效 Token 掩码、生成批次、可选 KL 项、优化器更新和分布式同步。

\`\`\`python
# rewards: [batch, group_size]
# token_logps / old_logps: [batch, group_size, seq_len]
responses, old_logps = generate_group(policy, prompts, group_size=G)
rewards = reward_fn(prompts, responses)

group_mean = rewards.mean(dim=1, keepdim=True)
group_std = rewards.std(dim=1, keepdim=True, unbiased=False)
advantages = (rewards - group_mean) / (group_std + 1e-6)

token_logps, token_mask = evaluate_policy(policy, prompts, responses)
ratio = (token_logps - old_logps).exp()
clipped_ratio = ratio.clamp(1 - epsilon, 1 + epsilon)

token_objective = torch.minimum(
    ratio * advantages.unsqueeze(-1),
    clipped_ratio * advantages.unsqueeze(-1)
)

# 按每条回答的有效 Token 数先平均，再按回答平均
response_objective = (
    (token_objective * token_mask).sum(dim=-1)
    / token_mask.sum(dim=-1).clamp_min(1)
)
policy_loss = -response_objective.mean()
# 可选：在此加入参考策略 KL 正则化
\`\`\`

## 六、GRPO 一定比 PPO 更省显存、更快吗？

**不一定。** 省去 Critic 的训练确实可以降低价值网络带来的模型参数、优化器状态和计算负担。但 GRPO 通常需要对每个问题生成多条回答，而且推理任务的输出可能很长。

因而，整体资源消耗至少受下列因素影响：模型大小、回答组大小 $G$、每个回答的长度、奖励计算成本、是否需要参考模型、旧策略概率缓存、每批次的更新次数，以及是否使用异步推理服务。

如果采样占据了大量时间，去掉 Critic 未必使端到端训练更快。如果任务本身具有密集的环境奖励，训练一个价值函数也可能提供更有效的时间步级学习信号。

因此，比较两种方法的资源成本，应同时记录**峰值显存、Token 生成量、训练吞吐、完成同一任务所需的 rollout 预算和最终任务表现**。只比较模型参数数量容易得出片面结论。

## 七、GRPO 的几个实际问题

**组内无差异。** 如果同组回答全部通过或全部失败，基于组内差异的优势就难以提供训练信号。可以调整题目难度、采样温度、组大小或奖励设计，但每种办法都可能改变数据分布与训练成本。

**奖励标准化带来的题目难度偏置。** 原始 GRPO 使用组内奖励标准差缩放优势。当某组奖励差异很小时，归一化可能放大该组对优化的影响。后续工作对此进行了分析，也提出不按组内标准差缩放等替代方案。参见 [Understanding R1-Zero-Like Training: A Critical Perspective](https://arxiv.org/abs/2503.20783) 及 [Hugging Face TRL 的 GRPO 文档](https://huggingface.co/docs/trl/grpo_trainer)。

**Token 级信用分配不足。** 结果监督 GRPO 将整个回答的得分赋给各个 Token。对于一段长推理，最终答案错误可能只源于某个关键步骤，但更新仍会作用于整段生成序列。DeepSeekMath 同时讨论了过程监督（Process Supervision）方案；其它变体也尝试改进细粒度奖励与信用分配。

**长度和损失归一化。** 原始 GRPO 先按每条回答的长度取平均。不同长度的回答因此会以特定方式影响梯度。后续出现了 DAPO、Dr. GRPO 等损失归一化变体。实际比较时需要明确所用损失版本，而不能只报告“使用 GRPO”。

## 八、放到 Agent 算法中，应该如何选择？

对只需生成一段完整回答的任务，例如数学证明、代码补全或结构化答案，可以自然地对同一 Prompt 采样多条结果，然后根据最终可验证的正确性评分。这样的任务容易构建 GRPO 的“同题多回答”训练批次。

而在 Tool-Using Agent 中，动作可能包括查询网页、调用 API、修改文件和执行代码。一次 Agent rollout 实际上是一条由**观察、决策、工具反馈和环境状态变化**组成的轨迹，而不只是静态文本。

例如，给 Coding Agent 一个修复 Issue 的任务，可以让它尝试多条完整轨迹，在隔离环境中运行测试，根据测试结果给奖励，再进行组内比较。GRPO 风格的方法可以用来训练这种行为，但需要仔细解决轨迹采样、工具结果变化、无效动作、执行失败和信用分配等问题。

对于多步 Agent，任务目标常常不止一个：成功完成任务、遵守权限、限制调用成本、避免破坏性操作，可能需要同时考虑。最终成功率可以作为奖励的一部分，但单一终局奖励难以告诉模型究竟哪一步出现问题。

因此，算法选择取决于**反馈结构和任务形态**，而不是简单地认为 GRPO 更新更先进：

| 场景 | 更值得首先考虑的方案 | 原因 |
| --- | --- | --- |
| 数学题、代码题，有可靠结果验证器 | GRPO 及其改进版本 | 容易同题采样，多答案比较信号明确 |
| 长程控制、连续动作、逐步奖励 | Actor-Critic PPO | 能利用状态价值和密集反馈 |
| 多步工具调用、有明确终局奖励 | GRPO 或 PPO 都可实验 | 关键在轨迹建模、奖励稀疏程度和资源预算 |
| 带预算、安全或权限硬约束的 Agent | 在 PPO/GRPO 外增加约束机制 | 相对奖励本身不能保证硬约束被满足 |

值得强调的是：把“整条 Agent 轨迹”当作 GRPO 的一个回答，仅是一种可行建模方式。状态和工具反馈会随动作而变，可能导致不同 rollout 的可比性下降；如果任务具有随机环境变化或外部副作用，还要控制初始状态、隔离执行环境，并确保奖励来自可信的实际结果。

这也与 Agent 评测直接相关。可靠的终局奖励需要能够独立判断 Agent 是否真正完成任务，详见 [《如何判断 Agent 是否完成任务？》](/research/how-to-evaluate-agent-task-completion/)。

## 九、结论

PPO 和 GRPO 的共同点是使用受限制的策略梯度更新。**典型 PPO 通过 Critic 与 GAE 估计优势；原始 GRPO 通过同题多回答的组内相对奖励估计优势。** 因此，GRPO 的主要优势是降低对独立 Critic 的依赖，代价则是需要足够有差异的组内样本，并且常常承担更高的多次生成成本。

对 LLM Agent 而言，真正需要先确定的是：奖励能否可靠验证？反馈只在任务结束后出现，还是每步都有？多条执行轨迹能否在相同条件下比较？是否包含不可违反的业务约束？

这些问题决定了 PPO、GRPO 以及它们的改进版本能否发挥作用。

## 参考资料

1. Schulman et al. [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347), 2017.
2. Schulman et al. [High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438), 2015.
3. Shao et al. [DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models](https://arxiv.org/abs/2402.03300), 2024.
4. DeepSeek-AI et al. [DeepSeek-R1 Incentivizes Reasoning in LLMs through Reinforcement Learning](https://www.nature.com/articles/s41586-025-09422-z), Nature, 2025.
5. [Understanding R1-Zero-Like Training: A Critical Perspective](https://arxiv.org/abs/2503.20783), 2025.
6. Hugging Face. [GRPO Trainer documentation](https://huggingface.co/docs/trl/grpo_trainer).
7. OpenAI. [Spinning Up: Proximal Policy Optimization](https://spinningup.openai.com/en/latest/algorithms/ppo.html).
