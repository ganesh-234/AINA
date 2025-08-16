import React, { useEffect, useRef } from "react";
import { useState } from "react";
import {
  FaPen,
  FaCopy,
  FaCheck,
  FaReply,
  FaTimes,
  FaStop,
} from "react-icons/fa";
import { useSelector } from "react-redux";
import {
  editTitle,
  getSingleChat,
  handleResponse,
  playVoice,
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
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recordText, setRecordText] = useState("");
  const [aiResponse, setAIResponse] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audio, setAudio] = useState(null);
  const [isThinking, setIsThinking] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    setUserScrolled(!isAtBottom);
  };

  const getConversation = async () => {
    try {
      const response = await getSingleChat(
        "api/chat/onechat",
        token,
        conversationId
      );
      console.log(response.data.singleconversation.messages);
      setChat(response.data.singleconversation.messages);
      setTitle(response.data.singleconversation.title);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    console.log(conversationId);
    getConversation();
  }, [conversationId, token]);

  useEffect(() => {
    // Only scroll to bottom if a new message is added (not on every keystroke)
    if (chat.length > prevChatLengthRef.current && !userScrolled) {
      scrollToBottom();
    }
    prevChatLengthRef.current = chat.length;
  }, [chat, userScrolled]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return; // prevent empty submits

    setLoading(true);
    const userMessage = { role: "user", content: prompt };
    setChat((prev) => [
      ...prev,
      userMessage,
      { role: "Aina", content: "Thinking...", loading: true, isThinking: true },
    ]);
    setPrompt("");

    const data = { conversationId, message: prompt };
    try {
      const response = await handleResponse("api/chat/send", token, data);
      console.log(response);
      setChat((prev) =>
        prev.map((msg) =>
          msg.loading
            ? {
                role: "Aina",
                content: "",
                fullContent: response.data.response,
                loading: true,
                isTyping: true,
              }
            : msg
        )
      );
    } catch (error) {
      setChat((prev) =>
        prev.map((msg) =>
          msg.loading
            ? { role: "Aina", content: "Sorry, something went wrong" }
            : msg
        )
      );
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  // Improved typing animation with cursor effect
  useEffect(() => {
    const interval = setInterval(() => {
      setChat((prev) =>
        prev.map((m) => {
          if (m.loading && m.isTyping && m.fullContent) {
            const currentLength = m.content.length;
            const fullLength = m.fullContent.length;

            if (currentLength < fullLength) {
              // Add one character at a time with variable speed
              const nextChar = m.fullContent[currentLength];
              // Variable typing speed - slower for punctuation
              const typingSpeed = [".", "!", "?", ",", ";", ":"].includes(
                nextChar
              )
                ? 200
                : 50;

              return {
                ...m,
                content: m.fullContent.slice(0, currentLength + 1),
              };
            } else {
              // Animation complete
              return {
                role: "Aina",
                content: m.fullContent,
                loading: false,
                isTyping: false,
              };
            }
          }
          return m;
        })
      );
    }, 16); // Base typing speed

    return () => clearInterval(interval);
  }, [chat]);

  // Render message with typing animation
  const renderMessage = (message, index) => {
    const isTyping = message.loading && message.isTyping;
    const isThinking = message.loading && message.isThinking;
    const isNewMessage =
      message.role === "Aina" && !message.loading && index === chat.length - 1;
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
    console.log(editedTitle);
    try {
      const response = await editTitle(
        "api/chat/edit",
        conversationId,
        token,
        editedTitle
      );
      setTitle(editedTitle);
      console.log(response);
    } catch (error) {
      console.log(error);
    } finally {
      setIsEditing(false);
    }
  };

  const { listening, transcript, resetTranscript } = useSpeechRecognition();
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
  }, [recordText]);
  //get the voice and create audio file
  useEffect(() => {
    const textToVoice = async () => {
      try {
        const response = await playVoice("api/tts/generate", token, aiResponse);
        console.log(response);
        const audioURL = URL.createObjectURL(response);
        setIsThinking(false);

        setIsSpeaking(true);

        const audio = new Audio(audioURL);
        setAudio(audio);
        audio.play();
        audio.onended = () => {
          setIsSpeaking(false);
        };
      } catch (error) {
        console.log(error);
        setIsSpeaking(false);
      }
    };
    textToVoice();
  }, [aiResponse]);

  const handleStopAISpeaking = () => {
    console.log(audio);
    if (audio) {
      audio.pause();
      setIsSpeaking(false);
    }
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
                Replying to {replyTo.role === "user" ? "your message" : "Aina"}
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
                title="Stop AINA"
              >
                <CiStop1 className="text-2xl" />
              </button>
            </div>
          </>
        ) : (
          <>
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
          Aina is designed for supportive conversations, not medical advice.
        </p>
      </div>
    </div>
  );
}
