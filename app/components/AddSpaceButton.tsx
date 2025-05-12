"use client";

import React, { useState } from 'react';
import { addSpace } from '../lib/db';

interface AddSpaceButtonProps {
  onSpaceAdded: () => void;
}

const AddSpaceButton: React.FC<AddSpaceButtonProps> = ({ onSpaceAdded }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceGroup, setNewSpaceGroup] = useState('Default');

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;
    
    await addSpace(newSpaceName.trim(), newSpaceGroup.trim() || 'Default');
    setNewSpaceName('');
    setNewSpaceGroup('Default');
    setIsModalOpen(false);
    onSpaceAdded();
  };

  return (
    <>
      <div className="relative w-full z-20 mt-2">
        <button
          onClick={() => setIsModalOpen(true)}
          className="add-space-button flex items-center justify-center w-full py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:from-red-600 hover:to-red-700"
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Space</span>
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-80 shadow-xl transform transition-all">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Create New Space</h3>
            <input
              type="text"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="Space name"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
              autoFocus
            />
            <input
              type="text"
              value={newSpaceGroup}
              onChange={(e) => setNewSpaceGroup(e.target.value)}
              placeholder="Group name (Default if empty)"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSpace}
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

export default AddSpaceButton;
