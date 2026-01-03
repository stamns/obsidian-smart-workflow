import { ItemView, WorkspaceLeaf, Notice, ButtonComponent, TextAreaComponent, MarkdownRenderer, setIcon } from 'obsidian';
import { ChatService } from '../../services/chat/chatService';
import { VoiceInputService, DictationResult } from '../../services/voice/voiceInputService';
import { t } from '../../i18n';

export const CHAT_VIEW_TYPE = 'smart-workflow-chat-view';

export class ChatView extends ItemView {
  private chatService: ChatService;
  private voiceInputService: VoiceInputService | null = null;
  private messageContainer: HTMLElement;
  private inputComponent: TextAreaComponent;
  private loadingIndicator: HTMLElement | null = null;
  private voiceBtn: ButtonComponent | null = null;

  constructor(leaf: WorkspaceLeaf, chatService: ChatService, voiceInputService?: VoiceInputService) {
    super(leaf);
    this.chatService = chatService;
    this.voiceInputService = voiceInputService || null;
  }

  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Smart Chat';
  }

  getIcon(): string {
    return 'message-circle';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('smart-chat-view');
    
    // Message History Area
    this.messageContainer = container.createDiv('chat-message-container');

    // Input Area
    const inputContainer = container.createDiv('chat-input-container');
    
    const inputWrapper = inputContainer.createDiv('chat-input-wrapper');

    // Text Area
    this.inputComponent = new TextAreaComponent(inputWrapper);
    this.inputComponent.inputEl.addClass('chat-input-textarea');
    this.inputComponent.setPlaceholder(t('chat.placeholder') || 'Ask AI...');
    this.inputComponent.inputEl.rows = 1;

    // Auto-resize textarea
    this.inputComponent.inputEl.addEventListener('input', () => {
        this.inputComponent.inputEl.style.height = 'auto';
        this.inputComponent.inputEl.style.height = `${Math.min(this.inputComponent.inputEl.scrollHeight, 150)}px`;
    });

    // Handle Enter to send (Shift+Enter for new line)
    this.inputComponent.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
    
    // Voice Button (if service available)
    if (this.voiceInputService) {
        this.voiceBtn = new ButtonComponent(inputWrapper);
        this.voiceBtn.setIcon('mic');
        this.voiceBtn.setClass('chat-voice-btn'); // New class for styling
        this.voiceBtn.setTooltip(t('commands.voiceDictation') || 'Voice Dictation');
        this.voiceBtn.onClick(() => this.handleVoiceClick());
    }

    // Send Button
    const sendBtn = new ButtonComponent(inputWrapper);
    sendBtn.setIcon('send'); // or 'arrow-up'
    sendBtn.setClass('chat-send-btn');
    sendBtn.setTooltip(t('common.confirm') || 'Send');
    sendBtn.onClick(() => this.handleSend());

    // Subscribe to messages
    this.chatService.on('message', (msg: any) => {
        this.hideLoading();
        this.appendMessage(msg);
    });
    
    // Load history (if any)
    const history = this.chatService.getHistory();
    history.forEach(msg => this.appendMessage(msg));
  }

  private async handleVoiceClick() {
      if (!this.voiceInputService || !this.voiceBtn) return;

      try {
          if (this.voiceInputService.isRecording()) {
              // Stop recording
              this.voiceBtn.setIcon('mic');
              this.voiceBtn.buttonEl.removeClass('is-recording');
              
              const result: DictationResult = await this.voiceInputService.executeDictationFlow();
              
              if (result && result.processedText) {
                  const currentText = this.inputComponent.getValue();
                  // Insert at cursor or append? Append for simplicity in chat
                  const newText = currentText ? `${currentText} ${result.processedText}` : result.processedText;
                  this.inputComponent.setValue(newText);
                  
                  // Trigger resize
                  this.inputComponent.inputEl.style.height = 'auto';
                  this.inputComponent.inputEl.style.height = `${Math.min(this.inputComponent.inputEl.scrollHeight, 150)}px`;
                  this.inputComponent.inputEl.focus();
              }
          } else {
              // Start recording
              await this.voiceInputService.startDictation();
              this.voiceBtn.setIcon('mic-off'); // or a stop icon
              this.voiceBtn.buttonEl.addClass('is-recording');
              new Notice('Listening...');
          }
      } catch (error) {
          new Notice(`Voice Error: ${error}`);
          // Reset button state on error
          this.voiceBtn.setIcon('mic');
          this.voiceBtn.buttonEl.removeClass('is-recording');
      }
  }

  private async handleSend() {
    const content = this.inputComponent.getValue().trim();
    if (!content) return;

    this.inputComponent.setValue('');
    this.inputComponent.inputEl.style.height = 'auto'; // Reset height
    
    // Show loading indicator
    this.showLoading();
    
    await this.chatService.sendMessage(content);
  }

  private showLoading() {
      if (this.loadingIndicator) return;
      
      this.loadingIndicator = this.messageContainer.createDiv('chat-message chat-message-assistant chat-loading');
      // Simple dots animation
      const dots = this.loadingIndicator.createDiv('typing-indicator');
      dots.createSpan();
      dots.createSpan();
      dots.createSpan();
      
      this.scrollToBottom();
  }

  private hideLoading() {
      if (this.loadingIndicator) {
          this.loadingIndicator.remove();
          this.loadingIndicator = null;
      }
  }

  private async appendMessage(message: { role: string; content: string }) {
    const msgDiv = this.messageContainer.createDiv(`chat-message chat-message-${message.role}`);
    
    // Role Icon/Label for Assistant
    if (message.role === 'assistant') {
         const iconDiv = msgDiv.createDiv('chat-message-icon');
         setIcon(iconDiv, 'bot');
    }

    const contentDiv = msgDiv.createDiv('chat-message-content markdown-preview-view');
    
    // Render Markdown
    await MarkdownRenderer.render(
        this.app,
        message.content,
        contentDiv,
        '',
        this
    );

    this.scrollToBottom();
  }
  
  private scrollToBottom() {
      // Use setTimeout to allow DOM update
      setTimeout(() => {
          this.messageContainer.scrollTo({ top: this.messageContainer.scrollHeight, behavior: 'smooth' });
      }, 50);
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }
}
