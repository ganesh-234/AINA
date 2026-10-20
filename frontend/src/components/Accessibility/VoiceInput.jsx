import { useEffect, useRef } from 'react';
import { FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

/**
 * Voice Input Component
 * Provides voice-to-text input with visual feedback
 * WCAG 2.2 compliant with proper ARIA labels
 */
export default function VoiceInput({ value = '', onChange, disabled }) {
  const { isListening, transcript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition();
  const initialValue = useRef('');

  // Update parent component when transcript changes
  useEffect(() => {
    if (transcript && onChange) {
      const prefix = initialValue.current.trim();
      onChange({ target: { value: prefix ? `${prefix} ${transcript}` : transcript } });
    }
  }, [transcript, onChange]);

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      initialValue.current = value;
      resetTranscript();
      startListening();
    }
  };

  if (!isSupported) {
    return null; // Hide if browser doesn't support speech recognition
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      className={`
        flex items-center justify-center p-2 rounded-lg transition-all
        ${isListening
          ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
          : 'bg-blue-500 text-white hover:bg-blue-600'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
      `}
      aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      aria-pressed={isListening}
      title={isListening ? 'Stop listening' : 'Click to speak'}
    >
      {isListening ? (
        <FaMicrophoneSlash className="w-5 h-5" aria-hidden="true" />
      ) : (
        <FaMicrophone className="w-5 h-5" aria-hidden="true" />
      )}
      <span className="sr-only">
        {isListening ? 'Recording voice input' : 'Voice input available'}
      </span>
    </button>
  );
}
