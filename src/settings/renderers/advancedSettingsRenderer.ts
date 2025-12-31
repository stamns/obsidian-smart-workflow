/**
 * 高级设置渲染器
 * 负责渲染性能调试设置
 */

import { Setting } from 'obsidian';
import type { RendererContext } from '../types';
import { BaseSettingsRenderer } from './baseRenderer';
import { t } from '../../i18n';

/**
 * 高级设置渲染器
 * 处理调试模式设置的渲染
 */
export class AdvancedSettingsRenderer extends BaseSettingsRenderer {
  /**
   * 渲染高级设置
   * @param context 渲染器上下文
   */
  render(context: RendererContext): void {
    this.context = context;
    const containerEl = context.containerEl;

    // 性能与调试设置
    this.renderPerformanceSettings(containerEl);
  }

  /**
   * 渲染性能与调试设置
   */
  private renderPerformanceSettings(containerEl: HTMLElement): void {
    const performanceCard = containerEl.createDiv();
    performanceCard.style.padding = '16px';
    performanceCard.style.borderRadius = '8px';
    performanceCard.style.backgroundColor = 'var(--background-secondary)';
    performanceCard.style.marginBottom = '10px';

    new Setting(performanceCard)
      .setName(t('settingsDetails.advanced.performanceAndDebug'))
      .setHeading();

    // 调试模式
    new Setting(performanceCard)
      .setName(t('settingsDetails.advanced.debugMode'))
      .setDesc(t('settingsDetails.advanced.debugModeDesc'))
      .addToggle(toggle => toggle
        .setValue(this.context.plugin.settings.debugMode)
        .onChange(async (value) => {
          this.context.plugin.settings.debugMode = value;
          await this.saveSettings();
        }));
  }
}
