import { Octokit } from "octokit";

class GitHubService {
  private octokit: Octokit;
  private owner: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.warn(
        "[GitHubService] GITHUB_TOKEN not set — GitHub API calls will fail",
      );
    }
    this.octokit = new Octokit({ auth: token });
    this.owner = process.env.GITHUB_OWNER || "TRIADBLUE";
  }

  get ownerName() {
    return this.owner;
  }

  get isConfigured() {
    return !!process.env.GITHUB_TOKEN;
  }

  async listRepos() {
    const { data } = await this.octokit.rest.repos.listForOrg({
      org: this.owner,
      sort: "updated",
      per_page: 100,
    });

    return data.map((repo) => ({
      name: repo.name,
      url: repo.html_url,
      description: repo.description,
      language: repo.language,
      updatedAt: repo.updated_at,
      defaultBranch: repo.default_branch,
      size: repo.size,
    }));
  }

  async getTree(repo: string, path?: string) {
    if (path && path !== "/" && path !== "") {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo,
        path,
      });

      if (!Array.isArray(data)) {
        return {
          type: "file" as const,
          contents: [
            {
              name: data.name,
              path: data.path,
              type: data.type as "file" | "dir",
              size: data.size ?? null,
            },
          ],
        };
      }

      return {
        type: "directory" as const,
        contents: data.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.type as "file" | "dir",
          size: item.size ?? null,
        })),
      };
    }

    // Root directory
    const { data } = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo,
      path: "",
    });

    const items = Array.isArray(data) ? data : [data];
    return {
      type: "directory" as const,
      contents: items.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type as "file" | "dir",
        size: item.size ?? null,
      })),
    };
  }

  async getFileContent(repo: string, path: string) {
    const { data } = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo,
      path,
    });

    if (Array.isArray(data) || data.type !== "file") {
      throw Object.assign(new Error("Path is a directory, not a file"), {
        status: 400,
      });
    }

    const content =
      "content" in data && data.content
        ? Buffer.from(data.content, "base64").toString("utf-8")
        : "";

    return {
      repo,
      name: data.name,
      path: data.path,
      size: data.size,
      encoding: "utf-8",
      content,
    };
  }

  async getCommits(repo: string, count: number = 10) {
    const { data } = await this.octokit.rest.repos.listCommits({
      owner: this.owner,
      repo,
      per_page: Math.min(count, 100),
    });

    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name || "Unknown",
      date: commit.commit.author?.date || "",
      url: commit.html_url,
    }));
  }

  async searchFiles(repo: string, query: string, path?: string) {
    const { data } = await this.octokit.rest.git.getTree({
      owner: this.owner,
      repo,
      tree_sha: "HEAD",
      recursive: "true",
    });

    const lowerQuery = query.toLowerCase();
    const basePath = path && path !== "/" ? path : "";

    const matches = data.tree
      .filter((item) => {
        if (item.type !== "blob") return false;
        if (!item.path) return false;
        if (basePath && !item.path.startsWith(basePath)) return false;
        return item.path.toLowerCase().includes(lowerQuery);
      })
      .slice(0, 100)
      .map((item) => ({
        name: item.path!.split("/").pop() || item.path!,
        path: item.path!,
        size: item.size || 0,
      }));

    return matches;
  }

  async getFileSha(
    repo: string,
    path: string,
    branch?: string,
  ): Promise<string | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo,
        path,
        ...(branch ? { ref: branch } : {}),
      });

      if (Array.isArray(data) || data.type !== "file") {
        return null;
      }
      return data.sha;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async pushFile(options: {
    repo: string;
    path: string;
    content: string;
    message: string;
    branch?: string;
  }): Promise<{ commitSha: string; commitUrl: string }> {
    const { repo, path, content, message, branch } = options;

    // Get existing file SHA if updating
    const existingSha = await this.getFileSha(repo, path, branch);

    const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo,
      path,
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      ...(existingSha ? { sha: existingSha } : {}),
      ...(branch ? { branch } : {}),
    });

    return {
      commitSha: data.commit.sha!,
      commitUrl: data.commit.html_url!,
    };
  }

  async extractRoutes(repo: string) {
    const candidatePaths = [
      "client/src/App.tsx",
      "client/src/App.jsx",
      "src/App.tsx",
      "src/App.jsx",
      "client/src/routes.tsx",
      "src/routes.tsx",
    ];

    for (const filePath of candidatePaths) {
      try {
        const file = await this.getFileContent(repo, filePath);
        const routePattern =
          /path=["']([^"']+)["']|path:\s*["']([^"']+)["']/g;
        const routes: string[] = [];
        let match;

        while ((match = routePattern.exec(file.content)) !== null) {
          const route = match[1] || match[2];
          if (route && !routes.includes(route)) {
            routes.push(route);
          }
        }

        routes.sort();

        return {
          sourceFile: filePath,
          routeCount: routes.length,
          routes,
        };
      } catch {
        continue;
      }
    }

    return {
      sourceFile: "none",
      routeCount: 0,
      routes: [],
    };
  }
}

export const githubService = new GitHubService();
