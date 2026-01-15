/**
 * Voice status dashboard renderer.
 * Used in settings and status bar.
 */

import { setIcon } from 'obsidian';
import { t } from '../../i18n';
import type { ConfigManager } from '../../services/config/configManager';
import type {
  SmartWorkflowSettings,
  VoiceASRProvider,
  VoiceASRMode,
  VoiceSettings,
} from '../../settings/settings';

/**
 * ASR 供应商显示信息
 * 按推荐顺序排列：豆包（推荐）> 阿里云 > 硅基流动
 */
const ASR_PROVIDER_INFO: Record<VoiceASRProvider, {
  name: string;
  modes: VoiceASRMode[];
  guideUrl?: string;
  modelName: string;
}> = {
  doubao: {
    name: '豆包 Doubao（推荐）',
    modes: ['realtime', 'http'],
    guideUrl: 'https://www.volcengine.com/docs/6561/163043',
    modelName: 'Doubao-Seed-ASR-2.0',
  },
  qwen: {
    name: '阿里云 Qwen',
    modes: ['realtime', 'http'],
    guideUrl: 'https://help.aliyun.com/zh/model-studio/developer-reference/get-api-key',
    modelName: 'qwen3-asr-flash',
  },
  sensevoice: {
    name: '硅基流动 SenseVoice',
    modes: ['http'],
    guideUrl: 'https://docs.siliconflow.cn/quickstart',
    modelName: 'FunAudioLLM/SenseVoiceSmall',
  },
};

/**
 * ASR 供应商顺序（用于下拉列表）
 */
const ASR_PROVIDER_ORDER: VoiceASRProvider[] = ['doubao', 'qwen', 'sensevoice'];

type VoiceStatusDashboardContext = {
  settings: SmartWorkflowSettings;
  configManager: ConfigManager;
  saveSettings: () => Promise<void>;
  variant?: 'menu' | 'settings';
};

/**
 * 语音识别状态表盘渲染器
 */
export class VoiceStatusDashboard {
  private settings: SmartWorkflowSettings;
  private configManager: ConfigManager;
  private saveSettings: () => Promise<void>;
  private variant: 'menu' | 'settings';

  constructor(context: VoiceStatusDashboardContext) {
    this.settings = context.settings;
    this.configManager = context.configManager;
    this.saveSettings = context.saveSettings;
    this.variant = context.variant ?? 'settings';
  }

  render(containerEl: HTMLElement): void {
    containerEl.empty();
    this.renderStatusDashboard(containerEl);
  }

  /**
   * 渲染状态表盘
   * 显示 ASR、LLM 后处理、AI 助手的配置状态
   */
  private renderStatusDashboard(containerEl: HTMLElement): void {
    const voiceSettings = this.settings.voice;

    // 创建表盘容器
    const dashboardEl = containerEl.createDiv({ cls: 'voice-status-dashboard' });
    if (this.variant === 'menu') {
      dashboardEl.addClass('voice-status-dashboard-compact');
    }

    // ASR 语音识别状态卡片
    this.renderASRStatusCard(dashboardEl, voiceSettings);

    // LLM 后处理状态卡片
    this.renderLLMStatusCard(dashboardEl, voiceSettings);

    // AI 助手状态卡片
    this.renderAssistantStatusCard(dashboardEl, voiceSettings);
  }

  /**
   * 渲染 ASR 状态卡片
   */
  private renderASRStatusCard(containerEl: HTMLElement, voiceSettings: VoiceSettings): void {
    const { card, headerEl, bodyEl } = this.createStatusCard(containerEl, {
      icon: 'mic',
      iconClass: 'asr',
      title: t('voice.dashboard.asrTitle'),
      collapsible: this.variant === 'menu',
      collapsedByDefault: this.variant === 'menu',
    });

    // 卡片内容
    const contentEl = bodyEl.createDiv({ cls: 'voice-status-card-content' });

    // 主模型 - 点击可选择
    const primaryInfo = ASR_PROVIDER_INFO[voiceSettings.primaryASR.provider];
    this.renderSelectableStatusItem(
      contentEl,
      t('voice.dashboard.primaryModel'),
      primaryInfo?.modelName || '-',
      'check-circle',
      'success',
      ASR_PROVIDER_ORDER.map(p => ({ value: p, label: ASR_PROVIDER_INFO[p].modelName })),
      voiceSettings.primaryASR.provider,
      async (value) => {
        const provider = value as VoiceASRProvider;
        const modes = ASR_PROVIDER_INFO[provider].modes;
        this.settings.voice.primaryASR = {
          ...this.settings.voice.primaryASR,
          provider,
          mode: modes[0],
        };
        await this.saveSettings();
      }
    );

    // 备用模型 - 点击可选择
    const backupProvider = voiceSettings.backupASR?.provider;
    const backupInfo = backupProvider ? ASR_PROVIDER_INFO[backupProvider] : null;
    const backupStatus = voiceSettings.enableFallback && backupInfo ? 'success' : 'muted';
    const backupIcon = voiceSettings.enableFallback && backupInfo ? 'shield-check' : 'shield-off';
    const backupOptions = [
      { value: '', label: t('voice.dashboard.notConfigured') },
      ...ASR_PROVIDER_ORDER.map(p => ({ value: p, label: ASR_PROVIDER_INFO[p].modelName }))
    ];
    this.renderSelectableStatusItem(
      contentEl,
      t('voice.dashboard.backupModel'),
      backupInfo?.modelName || t('voice.dashboard.notConfigured'),
      backupIcon,
      backupStatus,
      backupOptions,
      backupProvider || '',
      async (value) => {
        if (!value) {
          this.settings.voice.backupASR = undefined;
        } else {
          const provider = value as VoiceASRProvider;
          const modes = ASR_PROVIDER_INFO[provider].modes;
          this.settings.voice.backupASR = {
            provider,
            mode: modes[0],
          };
        }
        await this.saveSettings();
      }
    );

    // ASR 模式 - 点击可切换
    const currentMode = voiceSettings.primaryASR.mode;
    const availableModes = ASR_PROVIDER_INFO[voiceSettings.primaryASR.provider].modes;
    const modeOptions = availableModes.map(m => ({
      value: m,
      label: m === 'realtime' ? t('voice.settings.asrModeRealtime') : t('voice.settings.asrModeHttp')
    }));
    this.renderSelectableStatusItem(
      contentEl,
      t('voice.dashboard.asrMode'),
      currentMode === 'realtime' ? t('voice.settings.asrModeRealtime') : t('voice.settings.asrModeHttp'),
      'radio',
      'info',
      modeOptions,
      currentMode,
      async (value) => {
        this.settings.voice.primaryASR.mode = value as VoiceASRMode;
        await this.saveSettings();
      }
    );

    // 移除末尾标点 - 点击可切换
    this.renderToggleStatusItem(
      contentEl, 
      t('voice.dashboard.removePunctuation'), 
      voiceSettings.removeTrailingPunctuation,
      async (value) => {
        this.settings.voice.removeTrailingPunctuation = value;
        await this.saveSettings();
      }
    );

    this.attachCollapseToggle(card, headerEl, bodyEl, this.variant === 'menu');
  }

  /**
   * 渲染 LLM 后处理状态卡片
   */
  private renderLLMStatusCard(containerEl: HTMLElement, voiceSettings: VoiceSettings): void {
    const { card, headerEl, bodyEl } = this.createStatusCard(containerEl, {
      icon: 'sparkles',
      iconClass: 'llm',
      title: t('voice.dashboard.llmTitle'),
      collapsible: this.variant === 'menu',
      collapsedByDefault: this.variant === 'menu',
    });

    // 状态开关 - 可点击切换
    this.renderHeaderToggle(headerEl, voiceSettings.enableLLMPostProcessing, async (value) => {
      this.settings.voice.enableLLMPostProcessing = value;
      await this.saveSettings();

      // 使用局部更新替代全量刷新
      this.toggleConditionalSection(
        bodyEl,
        'llm-status-content',
        value,
        (el) => this.renderLLMStatusCardContent(el, true),
        undefined
      );
      // 如果禁用，显示提示
      this.toggleConditionalSection(
        bodyEl,
        'llm-status-hint',
        !value,
        (el) => this.renderLLMStatusCardHint(el),
        undefined
      );
    });
    
    // 卡片内容区域 - 初始渲染
    this.toggleConditionalSection(
      bodyEl,
      'llm-status-content',
      voiceSettings.enableLLMPostProcessing,
      (el) => this.renderLLMStatusCardContent(el, true),
      undefined
    );
    // 禁用提示 - 初始渲染
    this.toggleConditionalSection(
      bodyEl,
      'llm-status-hint',
      !voiceSettings.enableLLMPostProcessing,
      (el) => this.renderLLMStatusCardHint(el),
      undefined
    );

    this.attachCollapseToggle(card, headerEl, bodyEl, this.variant === 'menu');
  }

  /**
   * 渲染 LLM 状态卡片内容
   */
  private renderLLMStatusCardContent(contentEl: HTMLElement, _isEnabled: boolean): void {
    const voiceSettings = this.settings.voice;

    // 当前预设 - 点击可选择
    const activePreset = voiceSettings.llmPresets.find(p => p.id === voiceSettings.activeLLMPresetId);
    const presetOptions = voiceSettings.llmPresets.map(p => ({ value: p.id, label: p.name }));
    this.renderSelectableStatusItem(
      contentEl,
      t('voice.dashboard.activePreset'),
      activePreset?.name || '-',
      'bookmark',
      'info',
      presetOptions,
      voiceSettings.activeLLMPresetId,
      async (value) => {
        this.settings.voice.activeLLMPresetId = value;
        await this.saveSettings();
      }
    );

    // 使用的模型 - 点击可选择
    let modelName = '-';
    let currentModelValue = '';
    if (voiceSettings.postProcessingProviderId && voiceSettings.postProcessingModelId) {
      const provider = this.configManager.getProvider(voiceSettings.postProcessingProviderId);
      const model = provider?.models.find(m => m.id === voiceSettings.postProcessingModelId);
      modelName = model?.displayName || model?.name || '-';
      currentModelValue = `${voiceSettings.postProcessingProviderId}|${voiceSettings.postProcessingModelId}`;
    }

    // 构建模型选项
    const modelOptions = this.buildProviderModelOptions();
    this.renderSelectableStatusItem(
      contentEl,
      t('voice.dashboard.llmModel'),
      modelName,
      'cpu',
      'success',
      modelOptions,
      currentModelValue,
      async (value) => {
        if (!value) {
          this.settings.voice.postProcessingProviderId = undefined;
          this.settings.voice.postProcessingModelId = undefined;
        } else {
          const [providerId, modelId] = value.split('|');
          this.settings.voice.postProcessingProviderId = providerId;
          this.settings.voice.postProcessingModelId = modelId;
        }
        await this.saveSettings();
      }
    );
  }

  /**
   * 渲染 LLM 状态卡片禁用提示
   */
  private renderLLMStatusCardHint(contentEl: HTMLElement): void {
    const hintEl = contentEl.createDiv({ cls: 'voice-status-hint clickable' });
    hintEl.setText(t('voice.dashboard.llmDisabledHint'));
    hintEl.addEventListener('click', async () => {
      this.settings.voice.enableLLMPostProcessing = true;
      await this.saveSettings();
      
      // 使用局部更新
      const card = contentEl.closest('.voice-status-card') as HTMLElement;
      const headerEl = card?.querySelector('.voice-status-card-header') as HTMLElement;
      const bodyEl = card?.querySelector('.voice-status-card-body') as HTMLElement;
      if (card && headerEl && bodyEl) {
        // 更新开关状态
        const toggleEl = headerEl.querySelector('.voice-status-toggle');
        if (toggleEl) {
          toggleEl.classList.add('active');
        }
        // 切换内容区域
        this.toggleConditionalSection(bodyEl, 'llm-status-hint', false, () => {}, undefined);
        this.toggleConditionalSection(bodyEl, 'llm-status-content', true, (el) => this.renderLLMStatusCardContent(el, true), undefined);
      }
    });
  }

  /**
   * 渲染 AI 助手状态卡片
   */
  private renderAssistantStatusCard(containerEl: HTMLElement, voiceSettings: VoiceSettings): void {
    const { card, headerEl, bodyEl } = this.createStatusCard(containerEl, {
      icon: 'bot',
      iconClass: 'assistant',
      title: t('voice.dashboard.assistantTitle'),
      collapsible: this.variant === 'menu',
      collapsedByDefault: this.variant === 'menu',
    });

    // 状态开关 - 可点击切换
    this.renderHeaderToggle(headerEl, voiceSettings.assistantConfig.enabled, async (value) => {
      this.settings.voice.assistantConfig.enabled = value;
      await this.saveSettings();

      // 使用局部更新替代全量刷新
      this.toggleConditionalSection(
        bodyEl,
        'assistant-status-content',
        value,
        (el) => this.renderAssistantStatusCardContent(el),
        undefined
      );
      // 如果禁用，显示提示
      this.toggleConditionalSection(
        bodyEl,
        'assistant-status-hint',
        !value,
        (el) => this.renderAssistantStatusCardHint(el),
        undefined
      );
    });
    
    // 卡片内容区域 - 初始渲染
    this.toggleConditionalSection(
      bodyEl,
      'assistant-status-content',
      voiceSettings.assistantConfig.enabled,
      (el) => this.renderAssistantStatusCardContent(el),
      undefined
    );
    // 禁用提示 - 初始渲染
    this.toggleConditionalSection(
      bodyEl,
      'assistant-status-hint',
      !voiceSettings.assistantConfig.enabled,
      (el) => this.renderAssistantStatusCardHint(el),
      undefined
    );

    this.attachCollapseToggle(card, headerEl, bodyEl, this.variant === 'menu');
  }

  /**
   * 渲染 AI 助手状态卡片内容
   */
  private renderAssistantStatusCardContent(contentEl: HTMLElement): void {
    const voiceSettings = this.settings.voice;

    // 使用的模型 - 点击可选择
    let modelName = '-';
    let currentModelValue = '';
    if (voiceSettings.assistantConfig.providerId && voiceSettings.assistantConfig.modelId) {
      const provider = this.configManager.getProvider(voiceSettings.assistantConfig.providerId);
      const model = provider?.models.find(m => m.id === voiceSettings.assistantConfig.modelId);
      modelName = model?.displayName || model?.name || '-';
      currentModelValue = `${voiceSettings.assistantConfig.providerId}|${voiceSettings.assistantConfig.modelId}`;
    }

    // 构建模型选项
    const modelOptions = this.buildProviderModelOptions();
    this.renderSelectableStatusItem(
      contentEl,
      t('voice.dashboard.assistantModel'),
      modelName,
      'cpu',
      'success',
      modelOptions,
      currentModelValue,
      async (value) => {
        if (!value) {
          this.settings.voice.assistantConfig.providerId = undefined;
          this.settings.voice.assistantConfig.modelId = undefined;
        } else {
          const [providerId, modelId] = value.split('|');
          this.settings.voice.assistantConfig.providerId = providerId;
          this.settings.voice.assistantConfig.modelId = modelId;
        }
        await this.saveSettings();
      }
    );

    // 支持的模式（只读显示）
    this.renderStatusItem(contentEl, t('voice.dashboard.qaMode'), t('voice.dashboard.supported'), 'message-circle', 'info');
    this.renderStatusItem(contentEl, t('voice.dashboard.textProcessMode'), t('voice.dashboard.supported'), 'file-text', 'info');
  }

  /**
   * 渲染 AI 助手状态卡片禁用提示
   */
  private renderAssistantStatusCardHint(contentEl: HTMLElement): void {
    const hintEl = contentEl.createDiv({ cls: 'voice-status-hint clickable' });
    hintEl.setText(t('voice.dashboard.assistantDisabledHint'));
    hintEl.addEventListener('click', async () => {
      this.settings.voice.assistantConfig.enabled = true;
      await this.saveSettings();
      
      // 使用局部更新
      const card = contentEl.closest('.voice-status-card') as HTMLElement;
      const headerEl = card?.querySelector('.voice-status-card-header') as HTMLElement;
      const bodyEl = card?.querySelector('.voice-status-card-body') as HTMLElement;
      if (card && headerEl && bodyEl) {
        // 更新开关状态
        const toggleEl = headerEl.querySelector('.voice-status-toggle');
        if (toggleEl) {
          toggleEl.classList.add('active');
        }
        // 切换内容区域
        this.toggleConditionalSection(bodyEl, 'assistant-status-hint', false, () => {}, undefined);
        this.toggleConditionalSection(bodyEl, 'assistant-status-content', true, (el) => this.renderAssistantStatusCardContent(el), undefined);
      }
    });
  }

  private createStatusCard(
    containerEl: HTMLElement,
    options: {
      icon: string;
      iconClass: string;
      title: string;
      collapsible: boolean;
      collapsedByDefault: boolean;
    }
  ): { card: HTMLElement; headerEl: HTMLElement; bodyEl: HTMLElement } {
    const card = containerEl.createDiv({ cls: 'voice-status-card' });

    const headerEl = card.createDiv({ cls: 'voice-status-card-header' });
    const iconEl = headerEl.createDiv({ cls: `voice-status-card-icon ${options.iconClass}` });
    setIcon(iconEl, options.icon);
    headerEl.createSpan({ cls: 'voice-status-card-title', text: options.title });

    const bodyEl = card.createDiv({ cls: 'voice-status-card-body' });
    if (options.collapsible && options.collapsedByDefault) {
      card.addClass('collapsed');
      bodyEl.setAttr('aria-hidden', 'true');
    }

    return { card, headerEl, bodyEl };
  }

  private attachCollapseToggle(
    card: HTMLElement,
    headerEl: HTMLElement,
    bodyEl: HTMLElement,
    isCollapsible: boolean
  ): void {
    if (!isCollapsible) {
      return;
    }

    const toggleEl = headerEl.createDiv({ cls: 'voice-status-card-collapse' });
    setIcon(toggleEl, 'chevron-down');

    toggleEl.addEventListener('click', (event) => {
      event.stopPropagation();
      const isCollapsed = card.classList.contains('collapsed');
      if (isCollapsed) {
        card.removeClass('collapsed');
        bodyEl.setAttr('aria-hidden', 'false');
      } else {
        card.addClass('collapsed');
        bodyEl.setAttr('aria-hidden', 'true');
      }
    });
  }

  /**
   * 构建供应商/模型选项列表
   */
  private buildProviderModelOptions(): Array<{ value: string; label: string; group?: string }> {
    const providers = this.configManager.getProviders();
    const options: Array<{ value: string; label: string; group?: string }> = [
      { value: '', label: t('settingsDetails.general.noBinding') }
    ];

    providers.forEach(provider => {
      provider.models.forEach(model => {
        options.push({
          value: `${provider.id}|${model.id}`,
          label: model.displayName || model.name,
          group: provider.name
        });
      });
    });

    return options;
  }

  /**
   * 渲染头部开关
   */
  private renderHeaderToggle(
    headerEl: HTMLElement,
    isEnabled: boolean,
    onChange: (value: boolean) => Promise<void>
  ): void {
    const toggleEl = headerEl.createDiv({ cls: `voice-status-toggle ${isEnabled ? 'active' : ''}` });
    const toggleTrack = toggleEl.createDiv({ cls: 'voice-status-toggle-track' });
    toggleTrack.createDiv({ cls: 'voice-status-toggle-thumb' });

    toggleEl.addEventListener('click', async (e) => {
      e.stopPropagation();
      await onChange(!isEnabled);
    });
  }

  /**
   * 渲染可选择的状态项
   */
  private renderSelectableStatusItem(
    containerEl: HTMLElement,
    label: string,
    value: string,
    iconName: string,
    status: 'success' | 'warning' | 'error' | 'info' | 'muted',
    options: Array<{ value: string; label: string; group?: string }>,
    currentValue: string,
    onChange: (value: string) => Promise<void>
  ): void {
    const itemEl = containerEl.createDiv({ cls: 'voice-status-item clickable' });

    // 图标
    const iconEl = itemEl.createDiv({ cls: `voice-status-item-icon ${status}` });
    setIcon(iconEl, iconName);

    // 标签
    itemEl.createSpan({ cls: 'voice-status-item-label', text: label });

    // 值（下拉选择）
    const selectWrapper = itemEl.createDiv({ cls: 'voice-status-item-select-wrapper' });
    const selectEl = selectWrapper.createEl('select', { cls: 'voice-status-item-select' });

    // 按组分类添加选项
    const groups = new Map<string, Array<{ value: string; label: string }>>();
    const ungrouped: Array<{ value: string; label: string }> = [];

    options.forEach(opt => {
      if (opt.group) {
        if (!groups.has(opt.group)) {
          groups.set(opt.group, []);
        }
        groups.get(opt.group)!.push(opt);
      } else {
        ungrouped.push(opt);
      }
    });

    // 添加未分组选项
    ungrouped.forEach(opt => {
      const optionEl = selectEl.createEl('option', { value: opt.value, text: opt.label });
      if (opt.value === currentValue) {
        optionEl.selected = true;
      }
    });

    // 添加分组选项
    groups.forEach((opts, groupName) => {
      const optgroup = selectEl.createEl('optgroup', { attr: { label: groupName } });
      opts.forEach(opt => {
        const optionEl = optgroup.createEl('option', { value: opt.value, text: opt.label });
        if (opt.value === currentValue) {
          optionEl.selected = true;
        }
      });
    });

    selectEl.addEventListener('change', async () => {
      await onChange(selectEl.value);
    });

    // 下拉箭头
    const arrowEl = selectWrapper.createDiv({ cls: 'voice-status-item-arrow' });
    setIcon(arrowEl, 'chevron-down');
  }

  /**
   * 渲染开关状态项
   */
  private renderToggleStatusItem(
    containerEl: HTMLElement,
    label: string,
    isEnabled: boolean,
    onChange: (value: boolean) => Promise<void>
  ): void {
    const itemEl = containerEl.createDiv({ cls: 'voice-status-item clickable' });

    // 图标
    const iconEl = itemEl.createDiv({ cls: `voice-status-item-icon ${isEnabled ? 'success' : 'muted'}` });
    setIcon(iconEl, isEnabled ? 'check' : 'x');

    // 标签
    itemEl.createSpan({ cls: 'voice-status-item-label', text: label });

    // 开关
    const toggleEl = itemEl.createDiv({ cls: `voice-status-item-toggle ${isEnabled ? 'active' : ''}` });
    const toggleTrack = toggleEl.createDiv({ cls: 'voice-status-item-toggle-track' });
    toggleTrack.createDiv({ cls: 'voice-status-item-toggle-thumb' });

    itemEl.addEventListener('click', async () => {
      await onChange(!isEnabled);
    });
  }

  /**
   * 渲染只读状态项
   */
  private renderStatusItem(
    containerEl: HTMLElement,
    label: string,
    value: string,
    iconName: string,
    status: 'success' | 'warning' | 'error' | 'info' | 'muted'
  ): void {
    const itemEl = containerEl.createDiv({ cls: 'voice-status-item' });

    // 图标
    const iconEl = itemEl.createDiv({ cls: `voice-status-item-icon ${status}` });
    setIcon(iconEl, iconName);
    // 标签
    itemEl.createSpan({ cls: 'voice-status-item-label', text: label });

    // 值（添加 title 属性显示完整内容）
    const valueEl = itemEl.createSpan({ cls: `voice-status-item-value ${status}`, text: value });
    valueEl.setAttribute('title', value);
  }

  /**
   * 切换条件渲染区域的显示/隐藏
   * 用于局部更新 DOM，避免全量刷新导致滚动位置丢失
   */
  private toggleConditionalSection(
    container: HTMLElement,
    sectionId: string,
    shouldShow: boolean,
    renderFn: (containerEl: HTMLElement) => void,
    insertAfter?: HTMLElement
  ): void {
    if (!container) {
      return;
    }

    const sectionClass = `conditional-section-${sectionId}`;
    const existingSection = container.querySelector<HTMLElement>(`.${sectionClass}`);

    if (shouldShow && !existingSection) {
      const sectionEl = container.createDiv({ cls: sectionClass });

      if (insertAfter && insertAfter.nextSibling) {
        container.insertBefore(sectionEl, insertAfter.nextSibling);
      } else if (insertAfter && !insertAfter.nextSibling) {
        container.appendChild(sectionEl);
      }

      try {
        renderFn(sectionEl);
      } catch (error) {
        console.error(`[VoiceStatusDashboard] Error rendering conditional section "${sectionId}":`, error);
      }
    } else if (!shouldShow && existingSection) {
      existingSection.remove();
    }
  }
}
