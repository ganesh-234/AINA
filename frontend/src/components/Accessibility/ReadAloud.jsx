import { useState, useEffect } from 'react';
import { FaPlay, FaPause, FaStop, FaCog } from 'react-icons/fa';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';

/**
 * Read Aloud Component
 * Provides text-to-speech with playback controls
 * WCAG 2.2 compliant with keyboard navigation and ARIA labels
 */
export default function ReadAloud({ text, autoPlay = false, className = '' }) {
  const {
    speak,
    pause,
    resume,
    cancel,
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    selectedVoice,
    setSelectedVoice,
    rate,
    setRate,
  } = useTextToSpeech();

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (autoPlay && text && isSupported) {
      speak(text);
    }
    return () => {
      cancel();
    };
  }, [autoPlay, text, isSupported, speak, cancel]);

  const handlePlay = () => {
    if (isPaused) {
      resume();
    } else {
      speak(text);
    }
  };

  const handlePause = () => {
    pause();
  };

  const handleStop = () => {
    cancel();
  };

  if (!isSupported || !text) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 ${className}`}
      role="region"
      aria-label="Read aloud controls"
    >
      <div className="flex items-center gap-2">
        {!isSpeaking || isPaused ? (
          <button
            type="button"
            onClick={handlePlay}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            aria-label={isPaused ? 'Resume reading' : 'Start reading aloud'}
            title={isPaused ? 'Resume' : 'Play'}
          >
            <FaPlay className="w-4 h-4 ml-0.5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500 text-white hover:bg-yellow-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            aria-label="Pause reading"
            title="Pause"
          >
            <FaPause className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          onClick={handleStop}
          disabled={!isSpeaking}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          aria-label="Stop reading"
          title="Stop"
        >
          <FaStop className="w-3 h-3" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-500 text-white hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          aria-label="Speech settings"
          aria-expanded={showSettings}
          title="Settings"
        >
          <FaCog className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <span className="text-sm text-blue-700 dark:text-blue-300 ml-2">
        {isSpeaking && !isPaused && 'Reading aloud...'}
        {isPaused && 'Paused'}
        {!isSpeaking && !isPaused && 'Click play to listen'}
      </span>

      {showSettings && (
        <div className="absolute mt-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 min-w-[300px]">
          <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
            Speech Settings
          </h3>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="voice-select"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Voice
              </label>
              <select
                id="voice-select"
                value={selectedVoice?.name || ''}
                onChange={(e) => {
                  const voice = voices.find((v) => v.name === e.target.value);
                  setSelectedVoice(voice);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="speed-slider"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Speed: {rate.toFixed(1)}x
              </label>
              <input
                id="speed-slider"
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
                aria-valuemin={0.5}
                aria-valuemax={2.0}
                aria-valuenow={rate}
                aria-label="Reading speed"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
