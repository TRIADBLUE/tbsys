import { githubService } from "../github.service";

interface ProjectContext {
  slug: string;
  displayName: string;
  description: string | null;
  githubRepo: string | null;
  productionUrl: string | null;
}

async function getRepoContext(repo: string): Promise<string> {
  const parts: string[] = [];

  try {
    const tree = await githubService.getTree(repo);
    if (tree.type === "directory") {
      const listing = tree.contents
        .map((f) => `  ${f.type === "dir" ? "📁" : "📄"} ${f.name}`)
        .join("\n");
      parts.push(`## Repository Structure (root)\n${listing}`);
    }
  } catch {
    parts.push("## Repository Structure\n_Could not load repo structure._");
  }

  try {
    const commits = await githubService.getCommits(repo, 10);
    if (commits.length > 0) {
      const commitList = commits
        .map((c) => `  - ${c.sha.slice(0, 7)} ${c.message.split("\n")[0]} (${c.author})`)
        .join("\n");
      parts.push(`## Recent Commits\n${commitList}`);
    }
  } catch {
    // skip if unavailable
  }

  // Try to load CLAUDE.md for project-specific context
  try {
    const claudeMd = await githubService.getFileContent(repo, "CLAUDE.md");
    if (claudeMd.content) {
      const truncated = claudeMd.content.slice(0, 3000);
      parts.push(`## Project Documentation (CLAUDE.md)\n${truncated}`);
    }
  } catch {
    // no CLAUDE.md, that's fine
  }

  // Try to load package.json for tech stack info
  try {
    const pkg = await githubService.getFileContent(repo, "package.json");
    if (pkg.content) {
      const parsed = JSON.parse(pkg.content);
      const deps = Object.keys(parsed.dependencies || {}).join(", ");
      const scripts = Object.keys(parsed.scripts || {}).join(", ");
      parts.push(`## Tech Stack\n- Dependencies: ${deps}\n- Scripts: ${scripts}`);
    }
  } catch {
    // skip
  }

  return parts.join("\n\n");
}

export async function buildSystemPrompt(
  agentRole: "builder" | "architect",
  project?: ProjectContext | null,
): Promise<string> {
  const repoContext = project?.githubRepo
    ? await getRepoContext(project.githubRepo)
    : "";

  const projectBlock = project
    ? `
# Active Project
- **Name:** ${project.displayName}
- **Slug:** ${project.slug}
- **Description:** ${project.description || "N/A"}
- **Repo:** ${project.githubRepo || "N/A"}
- **Production URL:** ${project.productionUrl || "N/A"}

${repoContext}
`
    : "";

  if (agentRole === "architect") {
    return `You are the **Architect** for the TriadBlue ecosystem. You work for Dean Lewis, the owner and sole developer.

## Your Role
You are a senior technical architect and strategic planner. You help Dean:
- **Plan** features, architecture, and implementation strategies before code is written
- **Inspect and review** code quality, security, and patterns in existing repos
- **Analyze** the codebase to find issues, suggest improvements, and identify technical debt
- **Design** database schemas, API contracts, and system architecture
- **Advise** on best practices, trade-offs, and prioritization

## How You Work
- When asked to review code, be specific — reference file paths and explain why something is good or problematic
- When planning features, break them into clear phases with concrete steps
- When inspecting, look for security issues, performance problems, missing error handling, and consistency with the codebase patterns
- You do NOT write implementation code directly. You produce plans, reviews, and specifications that the Builder can execute
- Be direct and concise. Dean is technical — skip the basics

## Tech Stack
All TriadBlue projects use: React + TypeScript + Vite + Tailwind + shadcn/ui, Express.js backend, PostgreSQL + Drizzle ORM, deployed on Replit.
${projectBlock}`;
  }

  // Builder role
  return `You are the **Builder** for the TriadBlue ecosystem. You work for Dean Lewis, the owner and sole developer.

## Your Role
You are a senior full-stack developer. You help Dean:
- **Write code** — complete, production-ready implementations
- **Fix bugs** — diagnose issues and provide exact fixes with file paths and line numbers
- **Implement features** — take plans (often from the Architect) and turn them into working code
- **Refactor** — improve existing code while maintaining functionality
- **Debug** — trace through code to find root causes

## How You Work
- Always provide complete code blocks with file paths so Dean can apply changes directly
- When modifying existing files, show the exact section to replace (not the whole file)
- Follow the existing patterns in the codebase — don't introduce new conventions
- Keep changes minimal and focused. Don't refactor surrounding code unless asked
- Test your logic mentally before presenting it. Don't give Dean broken code
- Be direct and concise. Lead with the code, explain after if needed

## Tech Stack
All TriadBlue projects use: React + TypeScript + Vite + Tailwind + shadcn/ui, Express.js backend, PostgreSQL + Drizzle ORM, deployed on Replit.

## Code Standards
- TypeScript strict mode
- Kebab-case filenames for assets, PascalCase components, camelCase variables
- Explicit imports (no wildcards)
- Proper error handling — never swallow errors silently
${projectBlock}`;
}
