"use client";

import React, { useState } from 'react';
import { addTopic } from '../lib/db';

interface AddTopicButtonProps {
  spaceId: string;
  onTopicAdded: () => void;
}

const AddTopicButton: React.FC<AddTopicButtonProps> = ({ spaceId, onTopicAdded }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicContent, setNewTopicContent] = useState('');

  const handleCreateTopic = async () => {
    if (!newTopicTitle.trim()) return;
    
    // Generate random position within the visible area
    const posX = Math.floor(Math.random() * 500) + 50; // Between 50 and 550
    const posY = Math.floor(Math.random() * 300) + 50; // Between 50 and 350
    
    await addTopic(spaceId, newTopicTitle.trim(), newTopicContent.trim(), posX, posY);
    setNewTopicTitle('');
    setNewTopicContent('');
    setIsModalOpen(false);
    onTopicAdded();
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="add-topic-button fixed bottom-6 right-6 flex items-center justify-center w-14 h-14 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:from-red-600 hover:to-red-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl transform transition-all">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Create New Topic</h3>
            <input
              type="text"
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              placeholder="Topic title"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
              autoFocus
            />
            <textarea
              value={newTopicContent}
              onChange={(e) => setNewTopicContent(e.target.value)}
              placeholder="Topic content (optional)"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-300 mb-4 h-24"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTopic}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AddTopicButton;
