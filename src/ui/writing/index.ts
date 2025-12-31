/**
 * Writing UI 模块导出
 */

export { WritingApplyView, WRITING_APPLY_VIEW_TYPE } from './writingApplyView';
export type { WritingApplyViewState, StreamState } from './writingApplyView';

export { WritingActionExecutor } from './writingActionExecutor';
export type { WritingActionContext } from './writingActionExecutor';

export { DiffEngine } from './diffEngine';
export type { DiffBlock, DiffBlockType, DiffResult, BlockDecision } from './diffEngine';

export { DecisionManager } from './decisionManager';
export type { DecisionChangeEvent } from './decisionManager';
