---
title: "Sequence Models for Partially Observable RL"
description: "Why memory matters in POMDPs, what a sequence encoder is actually estimating, and how recurrent and transformer policies differ in training."
pubDate: 2026-08-12
tags: ["POMDP", "Transformer", "Reinforcement Learning"]
featured: true
readingTime: "12 min read"
---

A partially observable Markov decision process differs from a fully observable MDP because the current observation is not sufficient to recover the latent environment state.

## POMDP formulation

A POMDP can be written as

$$
\mathcal{M} = (\mathcal{S}, \mathcal{A}, \mathcal{O}, P, O, R, \gamma)
$$

where the agent receives an observation $o_t$ rather than the latent state $s_t$. The optimal action can therefore depend on the complete interaction history

$$
h_t = (o_0, a_0, o_1, a_1, \ldots, o_t).
$$

A history-dependent policy is

$$
\pi(a_t \mid h_t).
$$

The sequence model is used to compress this growing history into a finite representation $z_t$.

## What the encoder learns

A recurrent policy uses an update such as

$$
z_t = f_{\theta}(z_{t-1}, o_t, a_{t-1}),
$$

while an attention-based model can construct $z_t$ from a window of previous tokens. Neither mechanism automatically produces a Bayesian belief state. Instead, the representation is optimized indirectly by the reinforcement-learning objective.

## Training consequences

For recurrent policies, data chunks must preserve sequence order and provide an appropriate initial hidden state. Truncated backpropagation limits how far gradients travel even if the hidden state itself carries older information.

Transformer-style policies move the difficulty elsewhere: context length, causal masking, memory caching, positional representation, and the relationship between rollout boundaries and attention context all become part of the algorithm.

## A fair comparison

When comparing feed-forward, recurrent, and transformer agents, keep the environment interaction budget, PPO update count, encoder capacity, observation preprocessing, and evaluation protocol as close as possible. Otherwise, an apparent memory advantage can be caused by a different optimization regime.
