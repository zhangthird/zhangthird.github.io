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
];

