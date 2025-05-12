"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Space, Topic, getSpaces, getTopics, addTopic, db } from "./lib/db";
import SpacesList from "./components/SpacesList";
import TopicCircle from "./components/TopicCircle";
import AddSpaceButton from "./components/AddSpaceButton";
import AddTopicButton from "./components/AddTopicButton";

import { SpacesProvider, useSpacesContext } from "./components/SpacesContext";

export default function Home() {
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);

  // Use Dexie's live query to automatically update when data changes
  const spaces = useLiveQuery(() => getSpaces(), []) || [];
  const topics = useLiveQuery(
    () => selectedSpace ? getTopics(selectedSpace.id) : [], 
    [selectedSpace]
  ) || [];

  // When spaces change, select the first one if none is selected
  useEffect(() => {
    if (spaces.length > 0 && !selectedSpace) {
      setSelectedSpace(spaces[0]);
    }
  }, [spaces, selectedSpace]);

  // Function to handle space refresh after adding a new one
  const handleSpaceAdded = () => {
    // The spaces will be automatically updated by the live query
    // We just need to make sure the latest space gets selected
    const getLatestSpace = async () => {
      const allSpaces = await getSpaces();
      if (allSpaces.length > 0) {
        setSelectedSpace(allSpaces[allSpaces.length - 1]);
      }
    };
    getLatestSpace();
  };

  // Function to handle topic selection - now handled by the TopicCircle component
  // which navigates directly to the subject page
  const handleTopicClick = (topic: Topic) => {
    // No longer needed as navigation happens in TopicCircle
    // Keeping for backward compatibility
    setSelectedTopic(topic);
    setIsTopicModalOpen(true);
  };

  // Function to close the topic detail modal
  const closeTopicModal = () => {
    setIsTopicModalOpen(false);
    setSelectedTopic(null);
  };

  return (
    <SpacesProvider>
      <div className="flex h-screen w-full overflow-hidden">
        {/* Sidebar - 1/3 of the screen */}
        <div className="w-1/3 sidebar flex flex-col h-full p-4">
          <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--primary)' }}>
            Fire Nation Temple
          </h1>
          
          {/* List of spaces */}
          <div className="flex-1 overflow-y-auto mb-4">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">Your Spaces</h2>
            {spaces.length === 0 ? (
              <div className="text-gray-500 italic text-center p-6 empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <p>No spaces yet. Create your first space below.</p>
              </div>
            ) : (
              <SpacesList 
                selectedSpace={selectedSpace} 
                onSelectSpace={setSelectedSpace} 
              />
            )}
          </div>
          
          {/* Add space button */}
          <AddSpaceButton onSpaceAdded={handleSpaceAdded} />
        </div>
        
        {/* Main content area - 2/3 of the screen */}
        <MainContent 
          selectedSpace={selectedSpace} 
          topics={topics} 
          handleTopicClick={handleTopicClick} 
        />
        
        {/* Topic detail modal */}
        {isTopicModalOpen && selectedTopic && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[500px] max-w-[90%] shadow-xl transform transition-all">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedTopic.title}</h3>
                <button 
                  onClick={closeTopicModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                {selectedTopic.content || (
                  <p className="text-gray-500 italic">No content for this topic yet.</p>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={closeTopicModal}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SpacesProvider>
  );
}

// MainContent component that uses the context
const MainContent = ({ 
  selectedSpace, 
  topics, 
  handleTopicClick 
}: { 
  selectedSpace: Space | null, 
  topics: Topic[], 
  handleTopicClick: (topic: Topic) => void 
}) => {
  const { subjectsLoading, fetchSubjectsForSpace } = useSpacesContext();
  
  // Fetch subjects when space changes
  useEffect(() => {
    if (selectedSpace) {
      fetchSubjectsForSpace(selectedSpace.id);
    }
  }, [selectedSpace, fetchSubjectsForSpace]);

  return (
    <div className="w-2/3 content-area h-full relative">
      {selectedSpace ? (
        <>
          <div className="p-4 border-b border-red-200 bg-opacity-90 backdrop-blur-sm sticky top-0 z-20">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              {selectedSpace.name}
            </h1>
          </div>
          
          {/* Topics canvas */}
          <div className="relative w-full h-[calc(100%-60px)] overflow-hidden">
            {subjectsLoading && selectedSpace && subjectsLoading[selectedSpace.id] ? (
              <div className="flex flex-col items-center justify-center h-full text-center empty-state">
                <svg className="animate-spin h-12 w-12 text-red-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <p className="text-lg mb-2">Loading topics...</p>
              </div>
            ) : topics.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                <p className="text-lg mb-2">No topics in this space yet</p>
                <p className="text-gray-500">Click the + button to add your first topic</p>
              </div>
            ) : (
              topics.map((topic) => (
                <TopicCircle 
                  key={topic.id} 
                  topic={topic} 
                  // No longer passing onClick as TopicCircle now handles navigation
                />
              ))
            )}
            
            {/* Add topic button */}
            {selectedSpace && (
              <AddTopicButton 
                spaceId={selectedSpace.id} 
                onTopicAdded={() => {}} 
              />
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--primary)' }}>Welcome to Fire Nation Temple</h2>
          <p className="text-lg mb-6">Select a space from the sidebar or create a new one to get started.</p>
          <div className="w-16 h-1 bg-gradient-to-r from-red-400 to-red-600 rounded-full mb-6"></div>
          <p className="text-gray-500">Your topics will appear here once you select a space.</p>
        </div>
      )}
    </div>
  );
};


