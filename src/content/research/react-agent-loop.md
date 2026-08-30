---
title: "A Minimal ReAct Agent Loop"
description: "A small control-flow view of an LLM agent: model call, tool selection, observation, state update, and termination."
pubDate: 2026-08-21
tags: ["AI Agents", "ReAct", "Tool Use"]
featured: true
readingTime: "8 min read"
---

A useful agent implementation should make the control flow visible. The smallest practical loop contains a model, a tool registry, a state object, and an explicit stopping condition.

## Problem setting

Let the agent state at step $t$ be $s_t$, including the conversation, tool observations, and any persistent working memory. The language model induces a conditional distribution over the next action:

$$
a_t \sim \pi_{\theta}(a \mid s_t)
$$

The action may be a final answer or a structured tool call. If it is a tool call, the environment returns an observation $o_{t+1}$ and the state is updated:

$$
s_{t+1} = f(s_t, a_t, o_{t+1})
$$

The implementation is therefore a small state machine, not merely repeated text generation.

## Control flow

```ts
while (steps < maxSteps) {
  const response = await model.generate(state.messages, tools);

  if (response.type === "final") {
    return response.text;
  }

  const tool = tools[response.toolName];
  const observation = await tool(response.arguments);

  state.messages.push(response.asAssistantMessage());
  state.messages.push({ role: "tool", content: observation });
  steps += 1;
}
```

The important implementation detail is that tool execution and state mutation remain outside the model. The model proposes an action; the host program validates and executes it.

## Failure modes

### Unbounded loops

A model can repeatedly call the same tool without improving the state. Always use a maximum step budget and, for production systems, detect repeated call signatures.

### Hidden state transitions

Framework abstractions can make it difficult to see which messages were appended after each action. During debugging, store a structured trace for every model call and tool result.

### Tool schema drift

Tool descriptions are part of the agent policy interface. Changing an argument name or description can change behavior even if the tool implementation is unchanged.

## Practical rule

Start with an explicit loop small enough to understand in one file. Introduce graph orchestration, persistence, retries, parallel tools, or sub-agents only when the application actually requires them.
