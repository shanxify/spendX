import React from 'react';
import ChatbotButton from './ChatbotButton';
import ChatbotWindow from './ChatbotWindow';
import { useChatbot } from './useChatbot';

function Chatbot() {
  const {
    messages,
    isLoading,
    error,
    isOpen,
    toggleChat,
    closeChat,
    sendMessage,
    retry,
    clearError,
  } = useChatbot();

  return (
    <>
      <ChatbotButton onClick={toggleChat} isOpen={isOpen} />
      <ChatbotWindow
        isOpen={isOpen}
        onClose={closeChat}
        messages={messages}
        isLoading={isLoading}
        error={error}
        onSend={sendMessage}
        onRetry={retry}
        onClearError={clearError}
      />
    </>
  );
}

export default React.memo(Chatbot);
