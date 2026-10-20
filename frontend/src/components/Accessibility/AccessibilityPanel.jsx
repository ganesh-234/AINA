import { useState } from 'react';
import { FaUniversalAccess, FaTimes } from 'react-icons/fa';

/**
 * Accessibility Settings Panel
 * Provides centralized accessibility controls
 * WCAG 2.2 Level AA compliant
 */
export default function AccessibilityPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState('medium');
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const applyFontSize = (size) => {
    setFontSize(size);
    const root = document.documentElement;
    switch (size) {
      case 'small':
        root.style.fontSize = '14px';
        break;
      case 'medium':
        root.style.fontSize = '16px';
        break;
      case 'large':
        root.style.fontSize = '18px';
        break;
      case 'x-large':
        root.style.fontSize = '20px';
        break;
      default:
        root.style.fontSize = '16px';
    }
  };

  const toggleHighContrast = () => {
    setHighContrast(!highContrast);
    document.documentElement.classList.toggle('high-contrast');
  };

  const toggleReducedMotion = () => {
    setReducedMotion(!reducedMotion);
    if (!reducedMotion) {
      document.documentElement.style.setProperty('--animation-duration', '0.01ms');
    } else {
      document.documentElement.style.removeProperty('--animation-duration');
    }
  };

  return (
    <>
      {/* Floating Accessibility Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all"
        aria-label="Open accessibility settings"
        title="Accessibility Settings"
      >
        <FaUniversalAccess className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="accessibility-panel-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2
                id="accessibility-panel-title"
                className="text-xl font-semibold text-gray-900 dark:text-gray-100"
              >
                Accessibility Settings
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="Close accessibility settings"
              >
                <FaTimes className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Settings */}
            <div className="p-6 space-y-6">
              {/* Font Size */}
              <div>
                <label
                  htmlFor="font-size-select"
                  className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
                >
                  Text Size
                </label>
                <select
                  id="font-size-select"
                  value={fontSize}
                  onChange={(e) => applyFontSize(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium (Default)</option>
                  <option value="large">Large</option>
                  <option value="x-large">Extra Large</option>
                </select>
              </div>

              {/* High Contrast */}
              <div className="flex items-center justify-between">
                <div>
                  <label
                    htmlFor="high-contrast-toggle"
                    className="text-sm font-medium text-gray-900 dark:text-gray-100"
                  >
                    High Contrast Mode
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Increases color contrast for better visibility
                  </p>
                </div>
                <button
                  id="high-contrast-toggle"
                  type="button"
                  role="switch"
                  aria-checked={highContrast}
                  onClick={toggleHighContrast}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    highContrast ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      highContrast ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Reduced Motion */}
              <div className="flex items-center justify-between">
                <div>
                  <label
                    htmlFor="reduced-motion-toggle"
                    className="text-sm font-medium text-gray-900 dark:text-gray-100"
                  >
                    Reduce Motion
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Minimizes animations and transitions
                  </p>
                </div>
                <button
                  id="reduced-motion-toggle"
                  type="button"
                  role="switch"
                  aria-checked={reducedMotion}
                  onClick={toggleReducedMotion}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    reducedMotion ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      reducedMotion ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Keyboard Navigation Hint */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Keyboard Navigation
                </h3>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Tab</kbd> - Navigate between elements</li>
                  <li><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> - Activate buttons</li>
                  <li><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> - Close dialogs</li>
                  <li><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Space</kbd> - Toggle checkboxes</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
