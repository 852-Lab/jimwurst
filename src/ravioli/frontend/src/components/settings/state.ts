export const state = {
  currentSubPage: 'general',
  ollamaConfig: {
    mode: 'default',
    base_url: 'http://localhost:11434',
    default_model: 'gemma3:4b',
    api_key: ''
  },
  apiKeyIsSet: false,
  isConfiguringOllama: false,
  motherduckTokenIsSet: false,
  isConfiguringMotherduck: false,
};

export const clearSettingsState = () => {
  state.currentSubPage = 'general';
  state.ollamaConfig = {
    mode: 'default',
    base_url: 'http://localhost:11434',
    default_model: 'gemma3:4b',
    api_key: ''
  };
  state.apiKeyIsSet = false;
  state.isConfiguringOllama = false;
  state.motherduckTokenIsSet = false;
  state.isConfiguringMotherduck = false;
};
