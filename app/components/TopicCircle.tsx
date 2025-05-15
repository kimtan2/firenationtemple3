"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { updateTopicPosition } from '../lib/db';
import { Topic } from '../lib/db';

interface TopicCircleProps {
  topic: Topic;
  onClick?: () => void;
}

const TopicCircle: React.FC<TopicCircleProps> = ({ topic, onClick }) => {
  const router = useRouter();
  const circleRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const circlePos = useRef({ x: topic.posX, y: topic.posY });
  
  // Set initial position on mount
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.style.left = `${topic.posX}px`;
      circleRef.current.style.top = `${topic.posY}px`;
    }
  }, [topic.posX, topic.posY]);
  
  // Set up mouse event handlers
  useEffect(() => {
    const element = circleRef.current;
    if (!element) return;
    
    // Mouse down handler
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Get current position
      const rect = element.getBoundingClientRect();
      const left = parseInt(element.style.left) || 0;
      const top = parseInt(element.style.top) || 0;
      
      // Set starting position
      startPos.current = { x: e.clientX, y: e.clientY };
      circlePos.current = { x: left, y: top };
      isDragging.current = true;
      
      // Add class for visual feedback
      element.classList.add('dragging');
    };
    
    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      
      // Calculate new position
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      
      const newLeft = circlePos.current.x + dx;
      const newTop = circlePos.current.y + dy;
      
      // Apply new position
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
    };
    
    // Mouse up handler
    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging.current) return;
      
      // Save final position
      const left = parseInt(element.style.left) || 0;
      const top = parseInt(element.style.top) || 0;
      
      // Only save if position changed
      if (left !== topic.posX || top !== topic.posY) {
        updateTopicPosition(topic.id, left, top);
      }
      
      // Reset state
      isDragging.current = false;
      element.classList.remove('dragging');
      
      // If it was a click (not a drag), navigate to subject page
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        if (onClick) {
          onClick();
        } else {
          // Navigate to the subject page
          router.push(`/subject/${topic.id}`);
        }
      }
    };
    
    // Add event listeners
    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Clean up
    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [topic.id, topic.posX, topic.posY, onClick]);
  
  return (
    <div 
      ref={circleRef}
      className="topic-circle-container absolute cursor-move"
      style={{
        position: 'absolute',
        left: topic.posX,
        top: topic.posY,
        userSelect: 'none',
        zIndex: 1
      }}
    >
      <div 
        className="topic-circle flex items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        style={{ width: '80px', height: '80px' }}
      >
        <div 
          className="topic-inner-circle flex items-center justify-center rounded-full bg-white bg-opacity-10 backdrop-blur-sm"
          style={{ width: '70px', height: '70px' }}
        >
          <div className="flex flex-col items-center justify-center">
            <span className="text-white font-bold text-xl" data-component-name="TopicCircle">
              {topic.title.charAt(0).toUpperCase()}
            </span>
            
            {/* Success average indicator */}
            {topic.successAverage !== undefined && (
              <span 
                className={`text-xs font-semibold mt-1 px-2 py-0.5 rounded-full ${
                  topic.successAverage <= 1.5 ? 'bg-gray-500' :
                  topic.successAverage <= 2.5 ? 'bg-yellow-500' :
                  topic.successAverage <= 3.5 ? 'bg-blue-500' :
                  'bg-green-500'
                }`}
                title={`Erfolgsergebnis: ${topic.successAverage.toFixed(2)}`}
              >
                {topic.successAverage.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="topic-title text-center mt-2 font-medium text-sm">{topic.title}</div>
    </div>
  );
};

export default TopicCircle;
