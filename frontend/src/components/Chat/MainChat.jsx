import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FaPen,
  FaCopy,
  FaCheck,
  FaReply,
  FaTimes,
  FaPause,
  FaPlay,
  FaForward,
} from "react-icons/fa";
import { useSelector } from "react-redux";
import {
  editTitle,
  getSingleChat,
  handleResponse,
} from "../../../services/axios.service";
import { useParams } from "react-router-dom";
import { MdOutlineDone } from "react-icons/md";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { CiStop1 } from "react-icons/ci";

export default function MainChat() {
  const [title, setTitle] = useState("");
  const [chat, setChat] = useState([]);
  const { token } = useSelector((state) => state.auth);
  const { conversationId } = useParams();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const prevChatLengthRef = useRef(0);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [pausedResponseId, setPausedResponseId] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recordText, setRecordText] = useState("");
  const [aiResponse, setAIResponse] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const [moodEntries, setMoodEntries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("moodEntries") || "[]");
    } catch {
      return [];
    }
  });
  const [todayMood, setTodayMood] = useState(() => {
    try {
      const entries = JSON.parse(localStorage.getItem("moodEntries") || "[]");
      const existing = entries.find((entry) => entry.date === today);
      return existing ? existing.rating : 0;
    } catch {
      return 0;
    }
  });
  const speechSynthesisRef = useRef(null);
  const abortControllerRef = useRef(null);
  const activeResponseIdRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const persistMoodEntries = (entries) => {
    const nextEntries = entries.slice(0, 7);
    setMoodEntries(nextEntries);
    try {
      localStorage.setItem("moodEntries", JSON.stringify(nextEntries));
    } catch (error) {
      console.error("Unable to save mood entries:", error);
    }
  };

  const saveMoodRating = (rating) => {
    const nextEntries = [
      { date: today, rating },
      ...moodEntries.filter((entry) => entry.date !== today),
    ];
    persistMoodEntries(nextEntries);
    setTodayMood(rating);
  };

  const speakText = (text) => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    setUserScrolled(!isAtBottom);
  };

  const getConversation = useCallback(async () => {
    try {
      const response = await getSingleChat(
        "api/chat/onechat",
        token,
        conversationId
      );
      console.log(response.data.singleconversation.messages);
      const normalizedMessages = response.data.singleconversation.messages.map(
        (msg) => ({
          ...msg,
          role: msg.role === "Aina" ? "assistant" : msg.role,
        })
      );
      setChat(normalizedMessages);
      setTitle(response.data.singleconversation.title);
    } catch (error) {
      console.log(error);
    }
  }, [conversationId, token]);

  useEffect(() => {
    getConversation();
  }, [getConversation]);

  useEffect(() => {
    // Only scroll to bottom if a new message is added (not on every keystroke)
    if (chat.length > prevChatLengthRef.current && !userScrolled) {
      scrollToBottom();
    }
    prevChatLengthRef.current = chat.length;
  }, [chat, userScrolled]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const message = prompt.trim();
    if (!message || loading) return;

    const responseId = crypto.randomUUID();
    const controller = new AbortController();
    activeResponseIdRef.current = responseId;
    abortControllerRef.current = controller;
    setLoading(true);
    setPausedResponseId(null);
    setChat((prev) => [
      ...prev,
      { role: "user", content: message },
      { role: "assistant", content: "Thinking...", loading: true, isThinking: true, responseId },
    ]);
    setPrompt("");

    try {
      const response = await handleResponse(
        "api/chat/send",
        token,
        { conversationId, message },
        controller.signal
      );
      setChat((prev) =>
        prev.map((item) =>
          item.responseId === responseId
            ? { ...item, content: "", fullContent: response.data.response, loading: true, isThinking: false, isTyping: true }
            : item
        )
      );
    } catch (error) {
      setChat((prev) =>
        error.code === "ERR_CANCELED"
          ? prev.filter((item) => item.responseId !== responseId)
          : prev.map((item) =>
              item.responseId === responseId
                ? { ...item, content: "Sorry, something went wrong", loading: false, isThinking: false }
                : item
            )
      );
      if (error.code !== "ERR_CANCELED") console.error(error);
    } finally {
      if (activeResponseIdRef.current === responseId) {
        activeResponseIdRef.current = null;
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const stopRequest = () => abortControllerRef.current?.abort();

  const activeTypingResponse = chat.find(
    (item) => item.loading && item.isTyping && item.fullContent
  );
  const isResponsePaused = activeTypingResponse?.responseId === pausedResponseId;

  const toggleResponsePause = () => {
    if (!activeTypingResponse) return;
    setPausedResponseId((current) =>
      current === activeTypingResponse.responseId ? null : activeTypingResponse.responseId
    );
  };

  const showFullResponse = () => {
    if (!activeTypingResponse) return;
    setChat((prev) =>
      prev.map((item) =>
        item.responseId === activeTypingResponse.responseId
          ? { ...item, content: item.fullContent, loading: false, isTyping: false }
          : item
      )
    );
    setPausedResponseId(null);
  };
  // Improved typing animation with cursor effect
  useEffect(() => {
    const interval = setInterval(() => {
      const typingMessage = chat.find(
        (m) =>
          m.loading &&
          m.isTyping &&
          m.fullContent &&
          m.responseId !== pausedResponseId
      );
      if (!typingMessage) return;

      setChat((prev) =>
        prev.map((m) => {
          if (m.responseId === typingMessage.responseId) {
            const currentLength = m.content.length;
            const fullLength = m.fullContent.length;
            if (currentLength < fullLength) {
              return {
                ...m,
                content: m.fullContent.slice(0, Math.min(currentLength + 4, fullLength)),
              };
            }
            return { ...m, content: m.fullContent, loading: false, isTyping: false };
          }
          return m;
        })
      );
    }, 16);

    return () => clearInterval(interval);
  }, [chat, pausedResponseId]);

  // Render message with typing animation
  const renderMessage = (message, index) => {
    const isTyping = message.loading && message.isTyping;
    const isThinking = message.loading && message.isThinking;
    const isAssistant = message.role === "assistant";
    const isNewMessage = isAssistant && !message.loading && index === chat.length - 1;
    const isUser = message.role === "user";
    // const reactions = messageReactions[index] || {};

    return (
      <div
        key={index}
        className={`flex ${isUser ? "justify-end" : "justify-start"} ${
          isNewMessage ? "message-fade-in" : ""
        } mb-4 group`}
      >
        <div
          className={`rounded-lg px-4 py-2 max-w-[75%] shadow-sm text-reveal relative transition-colors duration-500
            ${
              isUser
                ? "bg-orange-100 dark:bg-orange-900 border border-orange-200 dark:border-orange-700 text-gray-900 dark:text-orange-100"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            }`}
        >
          <span>{message.content}</span>
          {isTyping && (
            <span className="inline-block w-0.5 h-4 bg-gray-600 dark:bg-gray-300 ml-1 typing-cursor"></span>
          )}
          {isThinking && (
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-300">
              Thinking...
            </span>
          )}

          {/* Actions: Copy, Reply */}
          {!isTyping && !isThinking && (
            <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => copyMessage(message.content, index)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Copy message"
              >
                {copiedIndex === index ? (
                  <FaCheck className="text-green-500 dark:text-green-400 text-xs" />
                ) : (
                  <FaCopy className="text-gray-400 dark:text-gray-300 text-xs hover:text-gray-600 dark:hover:text-gray-100" />
                )}
              </button>
              <button
                onClick={() => handleReply(message)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Reply to message"
              >
                <FaReply className="text-gray-400 dark:text-gray-300 text-xs hover:text-gray-600 dark:hover:text-gray-100" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Copy to clipboard
  const copyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  // Reply logic
  const handleReply = (message) => {
    setReplyTo(message);
    const input = document.querySelector('input[type="text"]');
    if (input) input.focus();
  };

  const clearReply = () => setReplyTo(null);

  //handle title edit
  const handleEditTitle = (e) => {
    e.preventDefault();
    setEditedTitle(title);
    setIsEditing(true);
  };
  //save edit title
  const saveEditTitle = async () => {
    try {
      await editTitle(
        "api/chat/edit",
        conversationId,
        token,
        editedTitle
      );
      setTitle(editedTitle);
    } catch (error) {
      console.log(error);
    } finally {
      setIsEditing(false);
    }
  };

  const { transcript, resetTranscript } = useSpeechRecognition();
  //voice message prompt
  const handleVoice = () => {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
    setIsListening(true);
  };
  //handle stop listening
  const handleStopListening = () => {
    SpeechRecognition.stopListening();
    console.log(transcript);
    setIsListening(false);
    setIsThinking(true);
    setRecordText(transcript.trim());

    // textToVoice();
  };
  //send message to backend to get response for voice
  useEffect(() => {
    if (!recordText || !recordText.trim()) return;
    let data = { conversationId, message: recordText };
    const getResponse = async () => {
      try {
        const response = await handleResponse("api/chat/send", token, data);
        console.log(response.data.response);
        setAIResponse(response.data.response);
      } catch (error) {
        console.log(error);
      }
    };

    getResponse();
  }, [recordText, conversationId, token]);
  //get the voice and create audio file
  useEffect(() => {
    if (!aiResponse || !aiResponse.trim()) return;
    speakText(aiResponse);
    setIsThinking(false);
  }, [aiResponse]);

  const handleStopAISpeaking = () => {
    stopSpeech();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex-shrink-0 border-b px-6 py-4 bg-white dark:bg-gray-800 dark:border-gray-700 transition-colors duration-500">
        {!isEditing ? (
          <>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
              {title ? title : "Untitled"}
              <div className="cursor-pointer">
                <FaPen className="text-sm ms-3" onClick={handleEditTitle} />
              </div>
            </h2>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold  text-gray-800 dark:text-gray-100 flex items-center">
              <input
                className="border p-1 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
                type="text"
                value={editedTitle}
                onChange={(e) => {
                  setEditedTitle(e.target.value);
                }}
              />
              <div className="cursor-pointer">
                <MdOutlineDone
                  className="text-2xl ms-3"
                  onClick={saveEditTitle}
                />
              </div>
            </h2>
          </>
        )}
      </div>

      <div className="flex-shrink-0 border-b px-6 py-4 bg-slate-50 dark:bg-slate-900 dark:border-slate-800 transition-colors duration-500">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400 mb-2">
                Daily mood check-in
              </p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                How are you feeling today?
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => saveMoodRating(rating)}
                  className={`w-10 h-10 rounded-full border text-sm font-semibold transition ${
                    todayMood === rating
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-700 border-gray-300 dark:bg-gray-900 dark:text-gray-100 dark:border-slate-700"
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
            {todayMood
              ? `Saved mood ${todayMood} for today.`
              : "Tap a rating to record how you feel."}
          </div>

          {moodEntries.length > 0 && (
            <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs text-gray-600 dark:text-gray-300">
              {moodEntries.map((entry) => (
                <div key={entry.date} className="space-y-1">
                  <div
                    className="mx-auto h-16 w-full rounded-full"
                    style={{
                      backgroundColor: entry.rating >= 4 ? "#fb923c" : entry.rating >= 3 ? "#facc15" : "#64748b",
                      height: `${Math.max(24, entry.rating * 14)}px`,
                    }}
                  />
                  <div>{entry.date.slice(5)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages - Scrollable Area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-6 bg-gray-50 dark:bg-gray-900 space-y-4 min-h-0"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {chat.map((message, index) => renderMessage(message, index))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Fixed at Bottom */}
      <div className="flex-shrink-0 border-t p-4 bg-white dark:bg-gray-800 dark:border-gray-700 transition-colors duration-500">
        {/* Reply Preview */}
        {replyTo && (
          <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900 border-l-4 border-orange-500 dark:border-orange-600 rounded-lg flex items-center justify-between transition-colors duration-500">
            <div className="flex-1">
              <div className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                Replying to {replyTo.role === "user" ? "your message" : "the assistant"}
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-100 truncate">
                {replyTo.content.length > 100
                  ? replyTo.content.substring(0, 100) + "..."
                  : replyTo.content}
              </div>
            </div>
            <button
              onClick={clearReply}
              className="ml-2 p-1 text-orange-600 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-400 transition-colors"
              title="Cancel reply"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>
        )}
        {isListening ? (
          <>
            <div className="flex justify-center items-center ">
              <h2 className="text-2xl font-bold text-orange-500">
                Listening....
              </h2>
              <button
                className="ms-2 text-orange-600 rounded-full bg-gray-100 p-2 hover:bg-orange-200 focus:ring-2 focus:ring-orange-500"
                onClick={handleStopListening}
                title="Stop speaking"
              >
                <CiStop1 className="text-2xl" />
              </button>
            </div>
          </>
        ) : isThinking ? (
          <>
            <div className="flex justify-center items-center ">
              <h2 className="text-2xl font-bold text-orange-500">
                Thinking....
              </h2>
            </div>
          </>
        ) : isSpeaking ? (
          <>
            <div className="flex justify-center items-center ">
              <h2 className="text-2xl font-bold text-orange-500">
                Speaking....
              </h2>
              <button
                className="ms-2 text-orange-600 rounded-full bg-gray-100 p-2 hover:bg-orange-200 focus:ring-2 focus:ring-orange-500"
                onClick={handleStopAISpeaking}
                title="Stop speech"
              >
                <CiStop1 className="text-2xl" />
              </button>
            </div>
          </>
        ) : (
          <>
            {(loading || activeTypingResponse) && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {loading && (
                  <button type="button" onClick={stopRequest} className="inline-flex items-center gap-2 rounded-full border border-orange-300 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950">
                    <CiStop1 /> Stop response
                  </button>
                )}
                {activeTypingResponse && (
                  <>
                    <button type="button" onClick={toggleResponsePause} className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                      {isResponsePaused ? <FaPlay /> : <FaPause />}
                      {isResponsePaused ? "Resume response" : "Pause response"}
                    </button>
                    <button type="button" onClick={showFullResponse} className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                      <FaForward /> Show full response
                    </button>
                  </>
                )}
              </div>
            )}
            <form
              className="flex space-x-2 items-center"
              onSubmit={handleSubmit}
            >
              <input
                type="text"
                placeholder="Type your message..."
                onChange={(e) => setPrompt(e.target.value)}
                value={prompt}
                disabled={loading}
                className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
              />
              {/* Voice input button UI */}
              <button
                type="button"
                className="bg-gray-100 text-orange-600 p-2 rounded-full hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 transition flex items-center justify-center dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-orange-900"
                title="Record voice message (UI only)"
                tabIndex={-1}
                onClick={handleVoice}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18.75v1.5m0 0h3.375m-3.375 0H8.625M12 18.75A6.75 6.75 0 005.25 12V8.25a6.75 6.75 0 1113.5 0V12a6.75 6.75 0 01-6.75 6.75z"
                  />
                </svg>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-orange-600 text-white px-4 py-2 rounded-full hover:bg-orange-700 transition disabled:opacity-50 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-orange-900"
              >
                {loading ? "Thinking..." : "Send"}
              </button>
            </form>
          </>
        )}

        <p className="text-xs text-gray-500 mt-2 text-center">
          This assistant is designed for supportive conversation and is not a substitute for professional medical advice.
        </p>
      </div>
    </div>
  );
}
