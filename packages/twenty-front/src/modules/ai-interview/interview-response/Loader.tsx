import React from 'react';

interface LoaderButtonProps {
  isLoading: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const LoaderButton: React.FC<LoaderButtonProps> = ({ isLoading, onClick, children }) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`relative w-full py-3 px-4 rounded-full font-medium text-white transition-colors ${
        isLoading ? 'bg-gray-700 text-gray-400' : 'bg-black hover:bg-gray-800'
      }`}
    >
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 text-purple-500" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"
            />
            <path
              fill="currentColor"
              d="M12 4c4.42 0 8 3.58 8 8h2c0-5.52-4.48-10-10-10v2z"
            />
          </svg>
        </span>
      )}
      <span className={isLoading ? 'invisible' : ''}>{children}</span>
    </button>
  );
};

export default LoaderButton;