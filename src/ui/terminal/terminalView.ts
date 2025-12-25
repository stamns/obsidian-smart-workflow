import { ItemView, WorkspaceLeaf, Notice, Menu } from 'obsidian';
import { TerminalService } from '../../services/terminal/terminalService';
import { TerminalInstance } from '../../services/terminal/terminalInstance';
import { errorLog } from '../../utils/logger';
import { t } from '../../i18n';
import { RenameTerminalModal } from './renameTerminalModal';

export const TERMINAL_VIEW_TYPE = 'terminal-view';

/**
 * 终端视图类
 */
export class TerminalView extends ItemView {
  private terminalService: TerminalService;
  private terminalInstance: TerminalInstance | null = null;
  private terminalContainer: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(leaf: WorkspaceLeaf, terminalService: TerminalService) {
    super(leaf);
    this.terminalService = terminalService;
  }

  getViewType(): string { return TERMINAL_VIEW_TYPE; }

  getDisplayText(): string {
    return this.terminalInstance?.getTitle() || t('terminal.defaultTitle');
  }

  getIcon(): string { return 'terminal'; }

  onPaneMenu(menu: Menu): void {
    menu.addItem((item) => {
      item.setTitle(t('terminal.renameTerminal'))
        .setIcon('pencil')
        .onClick(() => this.showRenameModal());
    });
  }

  private showRenameModal(): void {
    const currentTitle = this.terminalInstance?.getTitle() || t('terminal.defaultTitle');
    
    new RenameTerminalModal(
      this.app,
      currentTitle,
      (newTitle: string) => {
        if (this.terminalInstance && newTitle.trim()) {
          this.terminalInstance.setTitle(newTitle.trim());
          (this.leaf as any).updateHeader();
        }
      }
    ).open();
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('terminal-view-container');
    
    Object.assign(container.style, {
      padding: '0', margin: '0', height: '100%', width: '100%',
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    });

    this.terminalContainer = container.createDiv('terminal-container');
    Object.assign(this.terminalContainer.style, {
      flex: '1', minHeight: '0', overflow: 'hidden'
    });

    setTimeout(async () => {
      if (!this.terminalInstance && this.terminalContainer) {
        await this.initializeTerminal();
        this.setupResizeObserver();
      }
    }, 0);
  }

  async onClose(): Promise<void> {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.terminalInstance) {
      try {
        await this.terminalService.destroyTerminal(this.terminalInstance.id);
      } catch (error) {
        errorLog('[TerminalView] Destroy failed:', error);
      }
      this.terminalInstance = null;
    }

    this.containerEl.empty();
  }

  private async initializeTerminal(): Promise<void> {
    try {
      this.terminalInstance = await this.terminalService.createTerminal();

      this.terminalInstance.onTitleChange(() => {
        this.leaf.view = this;
      });

      this.applyBackgroundImage();
      this.applyTextOpacity();
      this.renderTerminal();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errorLog('[TerminalView] Init failed:', errorMessage);
      new Notice(t('notices.terminal.initFailed', { message: errorMessage }));
      this.leaf.detach();
    }
  }

  private applyBackgroundImage(): void {
    if (!this.terminalContainer || !this.terminalInstance) return;

    const options = (this.terminalInstance as any).options;
    
    if (options?.useObsidianTheme || options?.preferredRenderer === 'webgl' || !options?.backgroundImage) {
      return;
    }

    const {
      backgroundImage,
      backgroundImageOpacity = 0.5,
      backgroundImageSize = 'cover',
      backgroundImagePosition = 'center',
      enableBlur = false,
      blurAmount = 10
    } = options;

    this.terminalContainer.addClass('has-background-image');
    this.containerEl.querySelector('.terminal-view-container')?.addClass('has-background-image');

    const bgLayer = this.terminalContainer.createDiv('terminal-background-image');
    const overlayOpacity = 1 - backgroundImageOpacity;
    const overlayGradient = `linear-gradient(rgba(0, 0, 0, ${overlayOpacity}), rgba(0, 0, 0, ${overlayOpacity}))`;

    Object.assign(bgLayer.style, {
      position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
      backgroundImage: `${overlayGradient}, url("${backgroundImage}")`,
      backgroundSize: backgroundImageSize,
      backgroundPosition: backgroundImagePosition,
      backgroundRepeat: 'no-repeat',
      pointerEvents: 'none',
      zIndex: '0',
      opacity: '1'
    });

    if (enableBlur && blurAmount > 0) {
      bgLayer.style.transform = 'scale(1.1)';
      bgLayer.style.filter = `blur(${blurAmount}px)`;
    }
  }

  private applyTextOpacity(): void {
    if (!this.terminalContainer || !this.terminalInstance) return;

    const options = (this.terminalInstance as any).options;
    
    if (options?.useObsidianTheme || options?.preferredRenderer === 'webgl' || !options?.backgroundImage) {
      return;
    }

    this.terminalContainer.style.setProperty('--terminal-text-opacity', String(options?.textOpacity ?? 1.0));
  }

  private renderTerminal(): void {
    if (!this.terminalContainer || !this.terminalInstance) {
      errorLog('[TerminalView] Render failed: missing container or instance');
      return;
    }

    const bgLayer = this.terminalContainer.querySelector('.terminal-background-image');
    this.terminalContainer.empty();
    if (bgLayer) this.terminalContainer.appendChild(bgLayer);

    try {
      this.terminalInstance.attachToElement(this.terminalContainer);
    } catch (error) {
      errorLog('[TerminalView] Attach failed:', error);
      new Notice(t('notices.terminal.renderFailed', { message: String(error) }));
      return;
    }

    setTimeout(() => {
      if (this.terminalInstance?.isAlive()) {
        this.terminalInstance.fit();
        this.terminalInstance.focus();
      }
    }, 100);
  }

  private setupResizeObserver(): void {
    if (!this.terminalContainer) return;

    let resizeTimeout: NodeJS.Timeout | null = null;

    this.resizeObserver = new ResizeObserver((entries) => {
      if (resizeTimeout) clearTimeout(resizeTimeout);

      resizeTimeout = setTimeout(() => {
        if (this.terminalInstance?.isAlive()) {
          const { width, height } = entries[0].contentRect;
          if (width > 0 && height > 0) {
            this.terminalInstance.fit();
          }
        }
      }, 100);
    });

    this.resizeObserver.observe(this.terminalContainer);
  }
}
