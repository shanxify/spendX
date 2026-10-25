import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';

const API_BASE = process.env.REACT_APP_API_URL || '/api';
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_FOR_API = 10;

const WELCOME_MESSAGE = {
  role: 'model',
  text: "Hi! I'm ArthX, your personal AI assistant. Ask me about your spending, transactions, and savings.",
  timestamp: Date.now(),
  id: 'welcome',
};

export function useChatbot() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const abortRef = useRef(null);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH || isLoading) return;

    setError(null);

    // Add user message to display
    const userMsg = {
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Get fresh auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Your session has expired. Please sign in again.');
        setIsLoading(false);
        return;
      }

      // Retrieve opening balance from authoritative local storage or session metadata
      const savedOpening = localStorage.getItem('openingBalance');
      let openingBalance = 0;
      if (savedOpening !== null && !isNaN(Number(savedOpening))) {
        openingBalance = Number(savedOpening);
      } else if (session.user?.user_metadata?.opening_balance !== undefined) {
        openingBalance = Number(session.user.user_metadata.opening_balance) || 0;
      }

      // Build history for API (last N messages, excluding welcome message)
      const allMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg];
      const historyForApi = allMessages.slice(-MAX_HISTORY_FOR_API).map(m => ({
        role: m.role,
        text: m.text,
      }));

      // Remove the last item (current message) from history — it goes as `message`
      const history = historyForApi.slice(0, -1);

      // Create abort controller for this request
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: trimmed, history, openingBalance }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error?.message || data?.error || 'Something went wrong';
        
        if (response.status === 401) {
          setError('Your session has expired. Please sign in again.');
        } else if (response.status === 429) {
          setError('You\'re sending messages too quickly. Please wait a moment.');
        } else {
          setError(typeof errorMsg === 'string' ? errorMsg : 'Something went wrong. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      if (data.reply) {
        const assistantMsg = {
          role: 'model',
          text: data.reply,
          timestamp: Date.now(),
          id: `model-${Date.now()}`,
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Chat error:', err);
      setError('Failed to reach ArthX. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, isLoading]);

  const retry = useCallback(() => {
    setError(null);
    // Find the last user message and resend
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      // Remove the last user message so sendMessage re-adds it
      setMessages(prev => prev.slice(0, -1));
      // Small delay to let state settle
      setTimeout(() => sendMessage(lastUserMsg.text), 50);
    }
  }, [messages, sendMessage]);

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    isLoading,
    error,
    isOpen,
    toggleChat,
    openChat,
    closeChat,
    sendMessage,
    retry,
    clearError,
  };
}
