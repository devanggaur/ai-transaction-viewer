import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Chat.css';
import './MarkdownComponents.css';

function Chat({ accessToken }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m your financial assistant. Ask me anything about your spending, income, or savings. For example: "How much did I spend on food last month?" or "What are my top expenses?"'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const syncToDatabase = async () => {
    if (!accessToken) {
      alert('Please connect your bank account first');
      return;
    }

    setSyncing(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90); // Last 90 days

      const response = await axios.post('/api/sync_to_database', {
        access_token: accessToken,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0]
      });

      setSynced(true);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `✅ Synced ${response.data.transactionCount} transactions to database. You can now ask me questions about your finances!`
      }]);
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Error syncing transactions: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    if (!synced) {
      alert('Please sync your transactions first!');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // Prepare conversation history for OpenAI
      const conversationHistory = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await axios.post('/api/chat', {
        message: userMessage,
        conversationHistory: conversationHistory
      });

      // Add AI response with function call info
      const aiMessage = {
        role: 'assistant',
        content: response.data.response,
        functionCalled: response.data.functionCalled,
        functionArgs: response.data.functionArgs,
        functionResult: response.data.functionResult
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>💬 Financial Assistant</h1>
        {!synced && (
          <button
            onClick={syncToDatabase}
            disabled={syncing || !accessToken}
            className="sync-button"
          >
            {syncing ? 'Syncing...' : 'Sync Transactions'}
          </button>
        )}
        {synced && <span className="synced-badge">✓ Synced</span>}
      </div>

      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-content">
              <div className="message-text">
                {message.role === 'assistant' ? (
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  message.content
                )}
              </div>

              {message.functionCalled && (
                <details className="function-details">
                  <summary>🔍 Transparency: Function Called</summary>
                  <div className="function-info">
                    <div className="function-name">
                      <strong>Function:</strong> {message.functionCalled}
                    </div>
                    <div className="function-args">
                      <strong>Parameters:</strong>
                      <pre>{JSON.stringify(message.functionArgs, null, 2)}</pre>
                    </div>
                    <div className="function-result">
                      <strong>Result:</strong>
                      <pre>{JSON.stringify(message.functionResult, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={synced ? "Ask about your finances..." : "Sync transactions first to get started"}
          disabled={!synced || loading}
          rows="1"
          className="chat-input"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading || !synced}
          className="send-button"
        >
          Send
        </button>
      </div>

      {synced && (
        <div className="example-questions">
          <strong>Try asking:</strong>
          <div className="question-chips">
            <span onClick={() => setInput("How much did I spend last month?")}>
              How much did I spend last month?
            </span>
            <span onClick={() => setInput("What are my top 5 expenses?")}>
              What are my top 5 expenses?
            </span>
            <span onClick={() => setInput("Show me my spending on food")}>
              Show me my spending on food
            </span>
            <span onClick={() => setInput("What's my savings rate?")}>
              What's my savings rate?
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
