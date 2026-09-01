export interface Project {
  slug: string;
  name: string;
  kind: [string, string];
  description: [string, string];
  highlights: [string, string][];
  tags: string[];
  repository: string;
  upstream: string;
  language: string;
  featured: boolean;
}

// These are public forks in the author's GitHub account. Keep both links so
// visitors can distinguish the hosted repository from the original project.
export const projects: Project[] = [
  {
    slug: 'webcanvas',
    name: 'WebCanvas',
    kind: ['Web-agent framework', 'Web 智能体框架'],
    description: [
      'An open-source framework for developing, training, and evaluating web agents on live web tasks.',
      '面向在线 Web 任务的智能体开发、训练与评测开源框架。',
    ],
    highlights: [
      ['Live web trajectories', '在线网页轨迹'],
      ['Training and evaluation toolkits', '训练与评测工具链'],
    ],
    tags: ['Agent', 'Web', 'Evaluation'],
    repository: 'https://github.com/zhangthird/WebCanvas',
    upstream: 'https://github.com/iMeanAI/WebCanvas',
    language: 'Python',
    featured: true,
  },
  {
    slug: 'cc-mini',
    name: 'cc-mini',
    kind: ['Coding agent', '编程智能体'],
    description: [
      'A lightweight Python coding assistant with an agentic tool loop, session persistence, and a small built-in toolset.',
      '轻量级 Python 编程助手，提供智能体工具循环、会话持久化与内置工具集。',
    ],
    highlights: [
      ['Read, edit, write, search, and shell tools', '读写、搜索与命令行工具'],
      ['Session persistence and context compression', '会话持久化与上下文压缩'],
    ],
    tags: ['Agent', 'LLM', 'Developer Tools'],
    repository: 'https://github.com/zhangthird/cc-mini',
    upstream: 'https://github.com/zhangthird/cc-mini',
    language: 'Python',
    featured: true,
  },
  {
    slug: 'rl-llm-prior',
    name: 'RL-LLM-Prior',
    kind: ['Reinforcement learning', '强化学习'],
    description: [
      'Research configurations for value-based LLM priors across ALFWorld and textual Overcooked environments.',
      '在 ALFWorld 与文本 Overcooked 环境中研究价值型 LLM 先验的实验配置。',
    ],
    highlights: [
      ['DQN-style training configurations', 'DQN 风格训练配置'],
      ['Embodied and cooperative text environments', '具身与协作文本环境'],
    ],
    tags: ['RL', 'LLM', 'ALFWorld'],
    repository: 'https://github.com/zhangthird/RL-LLM-Prior',
    upstream: 'https://github.com/zhangthird/RL-LLM-Prior',
    language: 'Python',
    featured: true,
  },
];
