"use client";

import React, { useState, useEffect, use, useRef, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Topic } from '../../lib/db';
import Link from 'next/link';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  topicId: string;
  isBold?: boolean;
  isItalic?: boolean;
  textColor?: string;
  questionHtmlContent?: string;
  htmlContent?: string;
  idOrder: number;
}

// Create FlashcardsContext
interface FlashcardsContextType {
  flashcards: Flashcard[];
  updateFlashcardOrder: (reorderedCards: Flashcard[]) => void;
}

const FlashcardsContext = createContext<FlashcardsContextType | undefined>(undefined);

const useFlashcards = () => {
  const context = useContext(FlashcardsContext);
  if (!context) {
    throw new Error('useFlashcards must be used within a FlashcardsProvider');
  }
  return context;
};

// Add this above the SubjectPageContent component
interface SubjectPageContextType {
  handleEditFlashcard: (card: Flashcard) => void;
  handleDeleteFlashcard: (id: string) => void;
}

const SubjectPageContext = createContext<SubjectPageContextType | undefined>(undefined);

export default function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params with React.use
  const resolvedParams = use(params);
  
  return (
    <DndProvider backend={HTML5Backend}>
      <SubjectPageContent params={resolvedParams} />
    </DndProvider>
  );
}

// Main component content
function SubjectPageContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionHtml, setNewQuestionHtml] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newHtmlContent, setNewHtmlContent] = useState('');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [selectedCard, setSelectedCard] = useState<Flashcard | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const answerEditorRef = useRef<HTMLDivElement>(null);
  const questionEditorRef = useRef<HTMLDivElement>(null);

  // Function to update flashcard order in database
  const updateFlashcardOrderInDb = async (reorderedCards: Flashcard[]) => {
    try {
      // Update each flashcard with its new order
      const updatePromises = reorderedCards.map((card, index) => {
        return updateDoc(doc(db, `topics/${params.id}/flashcards`, card.id), {
          idOrder: index + 1
        });
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating flashcard order:', error);
    }
  };

  // Function to update flashcard order in state and database
  const updateFlashcardOrder = (reorderedCards: Flashcard[]) => {
    setFlashcards(reorderedCards);
    updateFlashcardOrderInDb(reorderedCards);
  };

  // Fetch topic and flashcards
  useEffect(() => {
    const fetchTopicAndFlashcards = async () => {
      try {
        setLoading(true);
        // Fetch topic
        const topicDoc = await getDoc(doc(db, 'topics', params.id));
        if (!topicDoc.exists()) {
          console.error('Topic not found');
          router.push('/');
          return;
        }
        
        const topicData = { id: topicDoc.id, ...topicDoc.data() } as Topic;
        setTopic(topicData);
        
        // Fetch flashcards
        const flashcardsSnapshot = await getDocs(collection(db, `topics/${params.id}/flashcards`));
        const flashcardsData = flashcardsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          topicId: params.id
        })) as Flashcard[];
        
        // Sort flashcards by idOrder
        const sortedFlashcards = flashcardsData.sort((a, b) => 
          (a.idOrder !== undefined && b.idOrder !== undefined) ? a.idOrder - b.idOrder : 0
        );
        
        setFlashcards(sortedFlashcards);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTopicAndFlashcards();
  }, [params.id, router]);

  // Create a new flashcard
  const handleCreateFlashcard = async () => {
    if (!newQuestion.trim() || (!newAnswer.trim() && !newHtmlContent)) return;
    
    try {
      const newFlashcard = {
        question: newQuestion,
        questionHtmlContent: newQuestionHtml,
        answer: newAnswer,
        htmlContent: newHtmlContent,
        isBold,
        isItalic,
        textColor,
        topicId: params.id,
        idOrder: flashcards.length + 1
      };
      
      const docRef = await addDoc(collection(db, `topics/${params.id}/flashcards`), newFlashcard);
      
      setFlashcards([...flashcards, { ...newFlashcard, id: docRef.id }]);
      resetForm();
      setIsCreatingCard(false);
    } catch (error) {
      console.error('Error creating flashcard:', error);
    }
  };
  
  // Import flashcards from JSON
  const handleImportJson = async () => {
    setJsonError(null);
    
    try {
      // Validate JSON format
      let parsedData;
      try {
        parsedData = JSON.parse(jsonInput);
      } catch (e) {
        setJsonError('Invalid JSON format. Please check your input.');
        return;
      }
      
      // Validate JSON structure
      if (!parsedData.cards || !Array.isArray(parsedData.cards) || parsedData.cards.length === 0) {
        setJsonError('Invalid JSON structure. The JSON must contain a "cards" array with at least one card.');
        return;
      }
      
      // Validate each card
      for (let i = 0; i < parsedData.cards.length; i++) {
        const card = parsedData.cards[i];
        if (!card.question || !card.answer) {
          setJsonError(`Card at index ${i} is missing required fields (question and answer).`);
          return;
        }
      }
      
      // Add order numbers if not present
      let maxOrder = flashcards.length > 0 
        ? Math.max(...flashcards.map(card => card.idOrder || 0)) 
        : 0;
      
      // Add all cards to Firestore
      const newCardRefs = [];
      const newCards = [];
      
      for (const card of parsedData.cards) {
        const newFlashcard = {
          question: card.question,
          answer: card.answer,
          questionHtmlContent: card.questionHtmlContent || '',
          htmlContent: card.htmlContent || '',
          isBold: card.isBold !== undefined ? card.isBold : false,
          isItalic: card.isItalic !== undefined ? card.isItalic : false,
          textColor: card.textColor || '#FFFFFF',
          topicId: params.id,
          idOrder: card.idOrder !== undefined ? card.idOrder : ++maxOrder
        };
        
        const docRef = await addDoc(collection(db, `topics/${params.id}/flashcards`), newFlashcard);
        newCardRefs.push(docRef);
        newCards.push({ ...newFlashcard, id: docRef.id });
      }
      
      // Update state with new cards
      setFlashcards([...flashcards, ...newCards]);
      setJsonInput('');
      setIsImportingJson(false);
      
    } catch (error) {
      console.error('Error importing flashcards:', error);
      setJsonError('An error occurred while importing flashcards. Please try again.');
    }
  };

  // Update an existing flashcard
  const handleUpdateFlashcard = async () => {
    if (!editingCardId || (!newQuestion.trim() && !newHtmlContent)) return;
    
    try {
      const updatedFlashcard = {
        question: newQuestion,
        questionHtmlContent: newQuestionHtml,
        answer: newAnswer,
        htmlContent: newHtmlContent,
        isBold,
        isItalic,
        textColor,
        topicId: params.id,
        idOrder: flashcards.find(card => card.id === editingCardId)?.idOrder || 0
      };
      
      await updateDoc(doc(db, `topics/${params.id}/flashcards`, editingCardId), updatedFlashcard);
      
      // Create the complete updated flashcard with id included
      const completeUpdatedCard = {
        ...updatedFlashcard,
        id: editingCardId
      };
      
      // Update the flashcard in the local state
      const updatedFlashcards = flashcards.map(card => 
        card.id === editingCardId 
          ? completeUpdatedCard 
          : card
      );
      
      // Get the learning mode state that was stored when editing started
      const learningState = (handleEditFlashcard as any).learningModeState;
      
      // If we were in learning mode before editing, prepare to restore that state
      if (learningState?.wasInLearningMode) {
        // Make sure we update the selectedCard directly if it's the one being edited
        if (selectedCard && selectedCard.id === editingCardId) {
          // Update the selected card with the new data
          setSelectedCard(completeUpdatedCard);
        }
      }
      
      // Update the flashcards array
      setFlashcards(updatedFlashcards);
      
      resetForm();
      setIsEditingCard(false);
      setEditingCardId(null);
      
      // If we were in learning mode before editing, restore the rest of the state
      if (learningState?.wasInLearningMode) {
        // Restore the card index and show answer state
        setCurrentCardIndex(learningState.previousCardIndex);
        setShowAnswer(learningState.previousShowAnswer);
      }
    } catch (error) {
      console.error('Error updating flashcard:', error);
    }
  };

  // Reset form fields
  const resetForm = () => {
    setNewQuestion('');
    setNewQuestionHtml('');
    setNewAnswer('');
    setNewHtmlContent('');
    setIsBold(false);
    setIsItalic(false);
    setTextColor('#FFFFFF');
    if (questionEditorRef.current) {
      questionEditorRef.current.innerHTML = '';
    }
    if (answerEditorRef.current) {
      answerEditorRef.current.innerHTML = '';
    }
  };

  // Open the edit modal for a flashcard
  const handleEditFlashcard = (card: Flashcard) => {
    // Store the current learning state if we're in learning mode
    const wasInLearningMode = selectedCard !== null;
    const previousCardIndex = currentCardIndex;
    const previousShowAnswer = showAnswer;
    
    setEditingCardId(card.id);
    setNewQuestion(card.question);
    setNewQuestionHtml(card.questionHtmlContent || '');
    setNewAnswer(card.answer);
    setNewHtmlContent(card.htmlContent || '');
    setIsBold(card.isBold || false);
    setIsItalic(card.isItalic || false);
    setTextColor(card.textColor || '#FFFFFF');
    setIsEditingCard(true);
    
    // Store the learning mode state in the component for later restoration
    setIsEditingCard(prevState => {
      // Store these values in a property of the state update function
      // so they can be accessed later when updating is complete
      (handleEditFlashcard as any).learningModeState = {
        wasInLearningMode,
        previousCardIndex,
        previousShowAnswer
      };
      return true;
    });
    
    // Set HTML content to the editor when the modal is open
    setTimeout(() => {
      if (questionEditorRef.current) {
        questionEditorRef.current.innerHTML = card.questionHtmlContent || '';
      }
    }, 0);
    setTimeout(() => {
      if (answerEditorRef.current && card.htmlContent) {
        answerEditorRef.current.innerHTML = card.htmlContent;
      }
    }, 0);
  };

  // Handle paste event to preserve formatting
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // Get the clipboard content as HTML
    const clipboardData = e.clipboardData;
    const pastedHtml = clipboardData.getData('text/html');
    const pastedText = clipboardData.getData('text');
    
    // Use HTML if available, otherwise use plain text
    if (pastedHtml) {
      // Create a temporary div to clean/process the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = pastedHtml;
      
      // Preserve all styling from the pasted content
      // This preserves classes, inline styles, and other attributes
      const cleanedHtml = tempDiv.innerHTML;
      
      // Insert the HTML with all its styling preserved
      document.execCommand('insertHTML', false, cleanedHtml);
      
      // Store the HTML content
      setTimeout(() => {
        if (answerEditorRef.current) {
          setNewHtmlContent(answerEditorRef.current.innerHTML);
          setNewAnswer(answerEditorRef.current.innerText);
        }
      }, 0);
    } else {
      document.execCommand('insertText', false, pastedText);
      setTimeout(() => {
        if (answerEditorRef.current) {
          setNewHtmlContent(answerEditorRef.current.innerHTML);
          setNewAnswer(answerEditorRef.current.innerText);
        }
      }, 0);
    }
  };

  // Handle paste for question editor
  const handleQuestionPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
    if (questionEditorRef.current) {
      document.execCommand('insertHTML', false, html);
      setTimeout(() => {
        setNewQuestionHtml(questionEditorRef.current?.innerHTML || '');
        setNewQuestion(questionEditorRef.current?.innerText || '');
      }, 0);
    }
  };

  // Update HTML content when input changes with better handling
  const handleAnswerChange = () => {
    if (answerEditorRef.current) {
      // Use a timeout to ensure the DOM has been updated
      setTimeout(() => {
        setNewHtmlContent(answerEditorRef.current?.innerHTML || '');
        setNewAnswer(answerEditorRef.current?.innerText || '');
      }, 0);
    }
  };

  // Handle question change
  const handleQuestionChange = () => {
    if (questionEditorRef.current) {
      setTimeout(() => {
        setNewQuestionHtml(questionEditorRef.current?.innerHTML || '');
        setNewQuestion(questionEditorRef.current?.innerText || '');
      }, 0);
    }
  };

  // Delete a flashcard
  const handleDeleteFlashcard = async (id: string) => {
    try {
      await deleteDoc(doc(db, `topics/${params.id}/flashcards`, id));
      setFlashcards(flashcards.filter(card => card.id !== id));
    } catch (error) {
      console.error('Error deleting flashcard:', error);
    }
  };

  // Start learning
  const handleStartLearning = () => {
    if (flashcards.length > 0) {
      setCurrentCardIndex(0);
      setSelectedCard(flashcards[0]);
      setShowAnswer(false);
    }
  };

  // Next card
  const handleNextCard = () => {
    if (!selectedCard) return;
    
    const nextIndex = (currentCardIndex + 1) % flashcards.length;
    
    setCurrentCardIndex(nextIndex);
    setSelectedCard(flashcards[nextIndex]);
    setShowAnswer(false);
  };

  // Previous card
  const handlePreviousCard = () => {
    if (!selectedCard) return;
    
    const prevIndex = (currentCardIndex - 1 + flashcards.length) % flashcards.length;
    
    setCurrentCardIndex(prevIndex);
    setSelectedCard(flashcards[prevIndex]);
    setShowAnswer(false);
  };

  // Get text style based on card formatting
  const getTextStyle = (card: Flashcard) => {
    return {
      fontWeight: card.isBold ? 'bold' : 'normal',
      fontStyle: card.isItalic ? 'italic' : 'normal',
      color: card.textColor || 'white'
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <SubjectPageContext.Provider value={{ handleEditFlashcard, handleDeleteFlashcard }}>
      <FlashcardsContext.Provider value={{ flashcards, updateFlashcardOrder }}>
        <div className="min-h-screen bg-gray-900 text-white p-6 overflow-y-auto">
          <div className="w-full mx-auto">
            {/* Header */}
            <div className="mb-8">
              <Link href="/" className="text-red-400 hover:text-red-300 mb-4 inline-flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Spaces
              </Link>
              <h1 className="text-3xl font-bold text-red-500">{topic?.title}</h1>
              <p className="text-gray-400 mt-2">Manage and learn your flashcards</p>
            </div>

            {/* Learning Mode */}
            {selectedCard ? (
              <div className="bg-white rounded-xl p-6 mb-8 shadow-xl border border-gray-200 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    <h2 className="text-xl font-semibold text-gray-800 mr-3">Learning Mode</h2>
                    <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                      {currentCardIndex + 1} / {flashcards.length}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setShowAnswer(!showAnswer)}
                      className="text-gray-500 hover:text-amber-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
                      title="Flip Card"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => {
                        if (selectedCard) {
                          handleEditFlashcard(selectedCard);
                          // Don't reset selectedCard or showAnswer here
                          // The state will be restored after editing
                        }
                      }}
                      className="text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
                      title="Edit Card"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => setSelectedCard(null)}
                      className="text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
                      title="Close"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="card-container mb-6">
                  <div className={`card ${showAnswer ? 'flipped' : ''}`}>
                    <div className="card-front bg-gray-50 p-8 flex items-center justify-center border border-gray-200 shadow-sm">
                      {selectedCard.questionHtmlContent ? (
                        <div className="text-xl text-center rich-content" style={getTextStyle(selectedCard)} dangerouslySetInnerHTML={{ __html: selectedCard.questionHtmlContent }} />
                      ) : (
                        <p className="text-xl text-center" style={getTextStyle(selectedCard)}>
                          {selectedCard.question}
                        </p>
                      )}
                    </div>
                    
                    <div className="card-back bg-gray-50 p-6 flex flex-col border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-medium mb-2 text-gray-800">Answer:</h3>
                      <div className="overflow-y-auto max-h-[250px]">
                        {selectedCard.htmlContent ? (
                          <div 
                            className="rich-content"
                            style={getTextStyle(selectedCard)}
                            dangerouslySetInnerHTML={{ __html: selectedCard.htmlContent }}
                          />
                        ) : (
                          <div style={getTextStyle(selectedCard)}>
                            {selectedCard.answer}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-4">
                  <button
                    onClick={handlePreviousCard}
                    className="p-3 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center shadow-md transition-all duration-200 text-gray-700 hover:scale-105"
                    title="Previous Card"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={handleNextCard}
                    className="p-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-md shadow-red-500/20 hover:shadow-red-400/30"
                    title="Next Card"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
            <>
              {/* Flashcards List */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Flashcards</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setIsImportingJson(true)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 rounded-xl font-medium flex items-center shadow-md shadow-blue-500/20 hover:shadow-blue-400/30 transition-all duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      Import JSON
                    </button>
                    <button
                      onClick={() => setIsCreatingCard(true)}
                      className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 rounded-xl font-medium flex items-center shadow-md shadow-red-500/20 hover:shadow-red-400/30 transition-all duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Add Flashcard
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-end mb-6">
                  <button
                    onClick={handleStartLearning}
                    disabled={flashcards.length === 0}
                    className={`px-4 py-2 rounded-xl font-medium flex items-center shadow-md ${
                      flashcards.length === 0 
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 transition-all duration-200'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    Start Learning
                  </button>
                </div>
                
                {flashcards.length === 0 ? (
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 text-center border border-gray-700/50 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-gray-400">No flashcards yet. Create your first one!</p>
                  </div>
                ) : (
                  <div className="max-h-[70vh] overflow-y-auto pr-2">
                    <FlashcardsList />
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Create Flashcard Modal */}
          {isCreatingCard && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Create New Flashcard</h2>
                  <button 
                    onClick={() => {
                      resetForm();
                      setIsCreatingCard(false);
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-300 mb-2">Question</label>
                  <div
                    ref={questionEditorRef}
                    contentEditable
                    onPaste={handleQuestionPaste}
                    onInput={handleQuestionChange}
                    className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-2 min-h-[50px] rich-text-editor"
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-gray-300 mb-2">Text Styling (Question)</label>
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => { document.execCommand('bold'); handleQuestionChange(); }} className="px-3 py-1 rounded bg-gray-600">Bold</button>
                    <button type="button" onClick={() => { document.execCommand('italic'); handleQuestionChange(); }} className="px-3 py-1 rounded bg-gray-600">Italic</button>
                    <div className="flex items-center">
                      <span className="mr-2">Color:</span>
                      <input type="color" value={textColor} onChange={(e) => { document.execCommand('foreColor', false, e.target.value); handleQuestionChange(); setTextColor(e.target.value); }} className="h-8 w-8 rounded cursor-pointer" />
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-gray-300 mb-2">Answer</label>
                  <div
                    ref={answerEditorRef}
                    contentEditable
                    onPaste={handlePaste}
                    onInput={handleAnswerChange}
                    className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-2 min-h-[100px] max-h-[300px] overflow-y-auto rich-text-editor"
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-gray-300 mb-2">Text Styling (Answer)</label>
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => { document.execCommand('bold'); handleAnswerChange(); }} className="px-3 py-1 rounded bg-gray-600">Bold</button>
                    <button type="button" onClick={() => { document.execCommand('italic'); handleAnswerChange(); }} className="px-3 py-1 rounded bg-gray-600">Italic</button>
                    <div className="flex items-center">
                      <span className="mr-2">Color:</span>
                      <input type="color" value={textColor} onChange={(e) => { document.execCommand('foreColor', false, e.target.value); handleAnswerChange(); setTextColor(e.target.value); }} className="h-8 w-8 rounded cursor-pointer" />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      resetForm();
                      setIsCreatingCard(false);
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateFlashcard}
                    disabled={!newQuestion.trim() || (!newAnswer.trim() && !newHtmlContent)}
                    className={`px-4 py-2 rounded-lg ${
                      !newQuestion.trim() || (!newAnswer.trim() && !newHtmlContent)
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Import JSON Modal */}
          {isImportingJson && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Import Flashcards from JSON</h2>
                  <button 
                    onClick={() => {
                      setIsImportingJson(false);
                      setJsonInput('');
                      setJsonError(null);
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {jsonError && (
                  <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                    <p className="font-medium">Error:</p>
                    <p>{jsonError}</p>
                  </div>
                )}
                
                <div className="mb-4">
                  <p className="text-gray-300 mb-2">Paste your JSON data below. Format example:</p>
                  <div className="bg-gray-900 p-3 rounded-lg text-xs font-mono text-gray-300 mb-4 overflow-auto max-h-36">
                    {`{
  "cards": [
    {
      "question": "Question text",
      "answer": "Answer text",
      "questionHtmlContent": "<div>Optional HTML</div>",
      "htmlContent": "<div>Optional HTML</div>",
      "isBold": false,
      "isItalic": false,
      "textColor": "#FFFFFF",
      "idOrder": 1
    }
  ]
}`}
                  </div>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    className="w-full p-3 bg-gray-700 font-mono text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 min-h-[200px] text-white"
                    placeholder="Paste your JSON here..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setIsImportingJson(false);
                      setJsonInput('');
                      setJsonError(null);
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportJson}
                    disabled={!jsonInput.trim()}
                    className={`px-4 py-2 rounded-lg ${
                      !jsonInput.trim()
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Edit Flashcard Modal */}
          {isEditingCard && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    <h2 className="text-xl font-semibold text-gray-800 mr-3">Edit Flashcard</h2>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => {
                        resetForm();
                        setIsEditingCard(false);
                        setEditingCardId(null);
                        
                        // Restore learning mode if we were in it
                        const learningState = (handleEditFlashcard as any).learningModeState;
                        if (learningState?.wasInLearningMode) {
                          setCurrentCardIndex(learningState.previousCardIndex);
                          setSelectedCard(flashcards[learningState.previousCardIndex]);
                          setShowAnswer(learningState.previousShowAnswer);
                        }
                      }}
                      className="text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
                      title="Close"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="card-container mb-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium mb-2 text-gray-800">Question:</h3>
                    <div
                      ref={questionEditorRef}
                      contentEditable
                      onPaste={handleQuestionPaste}
                      onInput={handleQuestionChange}
                      className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 mb-2 min-h-[100px] rich-text-editor text-gray-800 font-medium"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="text-lg font-medium mb-2 text-gray-800">Answer:</h3>
                    <div
                      ref={answerEditorRef}
                      contentEditable
                      onPaste={handlePaste}
                      onInput={handleAnswerChange}
                      className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 mb-2 min-h-[150px] max-h-[300px] overflow-y-auto rich-text-editor text-gray-800 font-medium"
                    />
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2 text-gray-800">Text Styling:</h3>
                  <div className="flex space-x-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <button 
                      type="button" 
                      onClick={() => { document.execCommand('bold'); handleAnswerChange(); handleQuestionChange(); }} 
                      className="px-4 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium shadow-sm"
                    >
                      Bold
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { document.execCommand('italic'); handleAnswerChange(); handleQuestionChange(); }} 
                      className="px-4 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium shadow-sm"
                    >
                      Italic
                    </button>
                    <div className="flex items-center">
                      <span className="mr-2 text-gray-700 font-medium">Color:</span>
                      <input 
                        type="color" 
                        value={textColor} 
                        onChange={(e) => { 
                          document.execCommand('foreColor', false, e.target.value); 
                          handleAnswerChange(); 
                          handleQuestionChange(); 
                          setTextColor(e.target.value); 
                        }} 
                        className="h-10 w-10 rounded cursor-pointer border border-gray-300 shadow-sm" 
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-6">
                  <button
                    onClick={() => {
                      resetForm();
                      setIsEditingCard(false);
                      setEditingCardId(null);
                      
                      // Restore learning mode if we were in it
                      const learningState = (handleEditFlashcard as any).learningModeState;
                      if (learningState?.wasInLearningMode) {
                        setCurrentCardIndex(learningState.previousCardIndex);
                        setSelectedCard(flashcards[learningState.previousCardIndex]);
                        setShowAnswer(learningState.previousShowAnswer);
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 font-medium shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateFlashcard}
                    disabled={!newQuestion.trim() || (!newAnswer.trim() && !newHtmlContent)}
                    className={`px-6 py-2 rounded-lg font-medium shadow-md ${
                      !newQuestion.trim() || (!newAnswer.trim() && !newHtmlContent)
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white transition-all duration-200 transform hover:scale-105 shadow-red-500/20 hover:shadow-red-400/30'
                    }`}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </FlashcardsContext.Provider>
    </SubjectPageContext.Provider>
  );
}

// DraggableFlashcard component
type DragItem = {
  index: number;
  id: string;
  type: string;
};

const ItemTypes = {
  CARD: 'card',
};

function DraggableFlashcard({ card, index, onEdit, onDelete }: { 
  card: Flashcard; 
  index: number;
  onEdit: (card: Flashcard) => void;
  onDelete: (id: string) => void;
}) {
  const { flashcards, updateFlashcardOrder } = useFlashcards();
  const ref = useRef<HTMLDivElement>(null);
  
  // Configure drag source
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.CARD,
    item: { index, id: card.id, type: ItemTypes.CARD },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  
  // Configure drop target
  const [, drop] = useDrop({
    accept: ItemTypes.CARD,
    hover: (item: DragItem, monitor) => {
      if (!ref.current) {
        return;
      }
      
      const dragIndex = item.index;
      const hoverIndex = index;
      
      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      
      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      
      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      
      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%
      
      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }
      
      // Time to actually perform the action
      moveCard(dragIndex, hoverIndex);
      
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    }
  });
  
  // Function to move card in the list
  const moveCard = (dragIndex: number, hoverIndex: number) => {
    const dragCard = flashcards[dragIndex];
    const newCards = [...flashcards];
    
    // Remove the card at dragIndex
    newCards.splice(dragIndex, 1);
    
    // Insert it at hoverIndex
    newCards.splice(hoverIndex, 0, dragCard);
    
    // Update the idOrder field for each card
    const reorderedCards = newCards.map((card, idx) => ({
      ...card,
      idOrder: idx + 1
    }));
    
    // Update the context with the new order
    updateFlashcardOrder(reorderedCards);
  };
  
  // Apply the drag and drop refs to the component
  drag(drop(ref));
  
  // Get text style based on card formatting
  const getTextStyle = (card: Flashcard) => {
    return {
      fontWeight: card.isBold ? 'bold' : 'normal',
      fontStyle: card.isItalic ? 'italic' : 'normal',
      color: card.textColor || 'white'
    };
  };
  
  return (
    <div 
      ref={ref}
      className={`bg-white rounded-xl p-5 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300 cursor-move h-[220px] flex flex-col border border-gray-200 relative overflow-hidden group ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
      onClick={() => onEdit(card)}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className="flex items-center">
          <span className="mr-2 text-gray-400 text-sm">{card.idOrder}.</span>
          <h3 className="font-semibold text-lg truncate text-gray-800" style={getTextStyle(card)}>
            {card.question}
          </h3>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(card);
            }}
            className="text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-red-500/20 via-gray-300/30 to-transparent my-2"></div>
      
      <div className="flex-grow overflow-y-auto mt-1 relative z-10 pr-1">
        {card.htmlContent ? (
          <div 
            className="text-gray-700 rich-content" 
            style={getTextStyle(card)}
            dangerouslySetInnerHTML={{ __html: card.htmlContent }}
          />
        ) : (
          <div className="text-gray-700" style={getTextStyle(card)}>
            {card.answer}
          </div>
        )}
      </div>
      
      <div className="absolute bottom-0 right-0 p-2 text-xs text-gray-400 italic flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
        </svg>
        Drag to reorder
      </div>
    </div>
  );
}

// FlashcardsList component that uses the context
function FlashcardsList() {
  const { flashcards } = useFlashcards();
  const contextValue = useContext(FlashcardsContext);
  
  // Access SubjectPageContent component's functions through a custom hook
  const subjectPageContext = useContext(SubjectPageContext);
  
  if (!contextValue) {
    throw new Error('FlashcardsList must be used within a FlashcardsProvider');
  }
  
  if (!subjectPageContext) {
    throw new Error('FlashcardsList must be used within a SubjectPageContext.Provider');
  }
  
  const { handleEditFlashcard, handleDeleteFlashcard } = subjectPageContext;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {flashcards.map((card, index) => (
        <DraggableFlashcard 
          key={card.id} 
          card={card} 
          index={index} 
          onEdit={handleEditFlashcard}
          onDelete={handleDeleteFlashcard}
        />
      ))}
    </div>
  );
}
