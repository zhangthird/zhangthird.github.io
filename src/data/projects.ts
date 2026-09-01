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

// Add a project here only when its contribution can be verified publicly.
export const projects: Project[] = [];

