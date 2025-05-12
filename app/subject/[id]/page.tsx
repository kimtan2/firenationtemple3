"use client";

import React, { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Topic } from '../../lib/db';
import Link from 'next/link';

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
}

export default function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params with React.use
  const resolvedParams = use(params);
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionHtml, setNewQuestionHtml] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newHtmlContent, setNewHtmlContent] = useState('');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [selectedCard, setSelectedCard] = useState<Flashcard | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const answerEditorRef = useRef<HTMLDivElement>(null);
  const questionEditorRef = useRef<HTMLDivElement>(null);

  // Fetch topic and flashcards
  useEffect(() => {
    const fetchTopicAndFlashcards = async () => {
      try {
        setLoading(true);
        // Fetch topic
        const topicDoc = await getDoc(doc(db, 'topics', resolvedParams.id));
        if (!topicDoc.exists()) {
          console.error('Topic not found');
          router.push('/');
          return;
        }
        
        const topicData = { id: topicDoc.id, ...topicDoc.data() } as Topic;
        setTopic(topicData);
        
        // Fetch flashcards
        const flashcardsSnapshot = await getDocs(collection(db, `topics/${resolvedParams.id}/flashcards`));
        const flashcardsData = flashcardsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          topicId: resolvedParams.id
        })) as Flashcard[];
        
        setFlashcards(flashcardsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTopicAndFlashcards();
  }, [resolvedParams.id, router]);

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
        topicId: resolvedParams.id
      };
      
      const docRef = await addDoc(collection(db, `topics/${resolvedParams.id}/flashcards`), newFlashcard);
      
      setFlashcards([...flashcards, { ...newFlashcard, id: docRef.id }]);
      resetForm();
      setIsCreatingCard(false);
    } catch (error) {
      console.error('Error creating flashcard:', error);
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
        topicId: resolvedParams.id
      };
      
      await updateDoc(doc(db, `topics/${resolvedParams.id}/flashcards`, editingCardId), updatedFlashcard);
      
      // Update the flashcard in the local state
      setFlashcards(flashcards.map(card => 
        card.id === editingCardId 
          ? { ...card, ...updatedFlashcard } 
          : card
      ));
      
      resetForm();
      setIsEditingCard(false);
      setEditingCardId(null);
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
    setEditingCardId(card.id);
    setNewQuestion(card.question);
    setNewQuestionHtml(card.questionHtmlContent || '');
    setNewAnswer(card.answer);
    setNewHtmlContent(card.htmlContent || '');
    setIsBold(card.isBold || false);
    setIsItalic(card.isItalic || false);
    setTextColor(card.textColor || '#FFFFFF');
    setIsEditingCard(true);
    
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
      await deleteDoc(doc(db, `topics/${resolvedParams.id}/flashcards`, id));
      setFlashcards(flashcards.filter(card => card.id !== id));
    } catch (error) {
      console.error('Error deleting flashcard:', error);
    }
  };

  // Start learning
  const handleStartLearning = () => {
    if (flashcards.length > 0) {
      setSelectedCard(flashcards[0]);
      setShowAnswer(false);
    }
  };

  // Next card
  const handleNextCard = () => {
    if (!selectedCard) return;
    
    const currentIndex = flashcards.findIndex(card => card.id === selectedCard.id);
    const nextIndex = (currentIndex + 1) % flashcards.length;
    
    setSelectedCard(flashcards[nextIndex]);
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
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
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
          <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Learning Mode</h2>
              <button 
                onClick={() => setSelectedCard(null)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-6 mb-4 min-h-[150px] flex items-center justify-center">
              {selectedCard.questionHtmlContent ? (
                <div className="text-xl text-center rich-content" style={getTextStyle(selectedCard)} dangerouslySetInnerHTML={{ __html: selectedCard.questionHtmlContent }} />
              ) : (
                <p className="text-xl text-center" style={getTextStyle(selectedCard)}>
                  {selectedCard.question}
                </p>
              )}
            </div>
            
            {showAnswer ? (
              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Answer:</h3>
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
            ) : (
              <button
                onClick={() => setShowAnswer(true)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg mb-4 font-medium"
              >
                Show Answer
              </button>
            )}
            
            <div className="flex justify-end">
              <button
                onClick={handleNextCard}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-medium flex items-center"
              >
                Next Card
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
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
                    onClick={() => setIsCreatingCard(true)}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-medium flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Flashcard
                  </button>
                  
                  <button
                    onClick={handleStartLearning}
                    disabled={flashcards.length === 0}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center ${
                      flashcards.length === 0 
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Lernen
                  </button>
                </div>
              </div>
              
              {flashcards.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-8 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-gray-400">No flashcards yet. Create your first one!</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {flashcards.map((card) => (
                    <div 
                      key={card.id} 
                      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer" 
                      onClick={() => handleEditFlashcard(card)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-lg" style={getTextStyle(card)}>
                          {card.question}
                        </h3>
                        <div className="flex space-x-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditFlashcard(card);
                            }}
                            className="text-gray-500 hover:text-blue-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFlashcard(card.id);
                            }}
                            className="text-gray-500 hover:text-red-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {card.htmlContent ? (
                        <div 
                          className="text-gray-400 rich-content" 
                          style={getTextStyle(card)}
                          dangerouslySetInnerHTML={{ __html: card.htmlContent }}
                        />
                      ) : (
                        <div className="text-gray-400" style={getTextStyle(card)}>
                          {card.answer}
                        </div>
                      )}
                    </div>
                  ))}
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

        {/* Edit Flashcard Modal */}
        {isEditingCard && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Edit Flashcard</h2>
                <button 
                  onClick={() => {
                    resetForm();
                    setIsEditingCard(false);
                    setEditingCardId(null);
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
                    setIsEditingCard(false);
                    setEditingCardId(null);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateFlashcard}
                  disabled={!newQuestion.trim() || (!newAnswer.trim() && !newHtmlContent)}
                  className={`px-4 py-2 rounded-lg ${
                    !newQuestion.trim() || (!newAnswer.trim() && !newHtmlContent)
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-red-500 hover:bg-red-600'
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
  );
}
