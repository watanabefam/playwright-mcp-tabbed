import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';

function userDataDir(): string | undefined {
  const dir = process.env.PLAYWRIGHT_MCP_USER_DATA_DIR?.trim();
  return dir || undefined;
}

type LaunchFn = (opts: any) => Promise<Browser>;
type ChannelEntry = {
  launch: LaunchFn;
  persistent: (dir: string, opts: any) => Promise<BrowserContext>;
  channel?: string;
};

const CHANNEL_MAP: Record<string, ChannelEntry> = {
  chrome: {
    launch: (opts) => chromium.launch(opts),
    persistent: (dir, opts) => chromium.launchPersistentContext(dir, opts),
  },
  msedge: {
    launch: (opts) => chromium.launch({ ...opts, channel: 'msedge' }),
    persistent: (dir, opts) => chromium.launchPersistentContext(dir, { ...opts, channel: 'msedge' }),
  },
  firefox: {
    launch: (opts) => firefox.launch(opts),
    persistent: (dir, opts) => firefox.launchPersistentContext(dir, opts),
  },
  webkit: {
    launch: (opts) => webkit.launch(opts),
    persistent: (dir, opts) => webkit.launchPersistentContext(dir, opts),
  },
};

function getBrowserChannel(): string {
  const env = process.env.PLAYWRIGHT_MCP_BROWSER || '';
  if (env && CHANNEL_MAP[env]) return env;
  return 'chrome';
}

export type TabListItem = {
  index: number;
  tab_id: string;
  label?: string;
  url: string;
  title: string;
};

type TabEntry = {
  page: Page;
  id: string;
  label?: string;
};

export class TabManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private tabs: Map<number, TabEntry> = new Map();
  /** Stable id -> tab index (survives until tab is closed). */
  private idToIndex: Map<string, number> = new Map();
  private nextIndex: number = 0;

  async ensureBrowser(): Promise<BrowserContext> {
    if (!this.browser && !this.context) {
      const channel = getBrowserChannel();
      const entry = CHANNEL_MAP[channel];
      const dir = userDataDir();
      const videoDir = process.env.PLAYWRIGHT_MCP_RECORD_VIDEO_DIR;
      if (dir) {
        this.context = await entry.persistent(dir, { headless: false, ...(videoDir ? { recordVideo: { dir: videoDir } } : {}) });
        this.browser = this.context.browser();
      } else {
        this.browser = await entry.launch({ headless: false });
        this.context = await this.browser.newContext(
          videoDir ? { recordVideo: { dir: videoDir } } : {}
        );
      }
    }
    return this.context!;
  }

  private removeTab(index: number): void {
    const entry = this.tabs.get(index);
    if (!entry) return;
    this.tabs.delete(index);
    this.idToIndex.delete(entry.id);
  }

  async getPage(tabIndex?: number): Promise<Page> {
    if (this.tabs.size === 0) {
      return (await this.newTab()).page;
    }

    if (tabIndex === undefined) {
      const first = [...this.tabs.keys()].sort((a, b) => a - b)[0];
      return this.tabs.get(first)!.page;
    }

    const entry = this.tabs.get(tabIndex);
    if (!entry) {
      throw new Error(`Tab index ${tabIndex} does not exist. Available tabs: [${[...this.tabs.keys()].join(', ')}]`);
    }
    return entry.page;
  }

  async resolveTabIndex(tabIndex?: number): Promise<number> {
    if (this.tabs.size === 0) {
      const { index } = await this.newTabAndGetIndex();
      return index;
    }

    if (tabIndex === undefined) {
      return [...this.tabs.keys()].sort((a, b) => a - b)[0];
    }

    if (!this.tabs.has(tabIndex)) {
      throw new Error(`Tab index ${tabIndex} does not exist. Available tabs: [${[...this.tabs.keys()].join(', ')}]`);
    }

    return tabIndex;
  }

  /** Resolve by stable tab_id (from browser_tabs list). */
  resolveTabId(tabId: string): number {
    const trimmed = tabId.trim();
    if (!trimmed) {
      throw new Error('tab_id must be a non-empty string');
    }
    const index = this.idToIndex.get(trimmed);
    if (index === undefined || !this.tabs.has(index)) {
      const known = [...this.idToIndex.keys()].slice(0, 5).join(', ');
      throw new Error(
        `Tab id "${trimmed}" does not exist. Known ids (sample): [${known || 'none'}]. Use browser_tabs list to see tab_id for each tab.`
      );
    }
    return index;
  }

  async newTab(label?: string): Promise<TabEntry> {
    const { entry } = await this.newTabAndGetIndex(label);
    return entry;
  }

  async newTabAndGetIndex(label?: string): Promise<{ index: number; page: Page; tab_id: string; entry: TabEntry }> {
    const context = await this.ensureBrowser();
    const page = await context.newPage();
    const index = this.nextIndex++;
    const id = randomUUID();
    const entry: TabEntry = { page, id, label: label?.trim() || undefined };
    this.tabs.set(index, entry);
    this.idToIndex.set(id, index);

    page.on('close', () => {
      this.removeTab(index);
    });

    return { index, page, tab_id: id, entry };
  }

  async closeTab(tabIndex: number): Promise<void> {
    const entry = this.tabs.get(tabIndex);
    if (!entry) {
      throw new Error(`Tab index ${tabIndex} does not exist`);
    }
    await entry.page.close();
  }

  listTabs(): Array<{ index: number; tab_id: string; label?: string; url: string; title: string }> {
    return [...this.tabs.entries()].map(([index, entry]) => ({
      index,
      tab_id: entry.id,
      label: entry.label,
      url: entry.page.url(),
      title: '',
    }));
  }

  async listTabsAsync(): Promise<TabListItem[]> {
    const results: TabListItem[] = [];
    for (const [index, entry] of this.tabs.entries()) {
      results.push({
        index,
        tab_id: entry.id,
        label: entry.label,
        url: entry.page.url(),
        title: await entry.page.title(),
      });
    }
    return results;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
    } else if (this.browser) {
      await this.browser.close().catch(() => {});
    }
    const proc = (this.browser as any)?.process?.();
    if (proc?.pid) {
      try { process.kill(-proc.pid, 'SIGKILL'); } catch { /* already dead */ }
      try { process.kill(proc.pid, 'SIGKILL'); } catch { /* already dead */ }
    }
    this.browser = null;
    this.context = null;
    this.tabs.clear();
    this.idToIndex.clear();
  }
}

export const tabManager = new TabManager();
