"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Space } from '../lib/db';
import { useSpacesContext } from './SpacesContext';
import './SpacesList.css';

interface SpacesListProps {
  selectedSpace: Space | null;
  onSelectSpace: (space: Space) => void;
}

const SpacesList: React.FC<SpacesListProps> = ({ selectedSpace, onSelectSpace }) => {
  const { spaces, addOrUpdateSpace, deleteSpace, addOrUpdateGroup, deleteGroup, spacesLoading } = useSpacesContext();
  const [spacesOrder, setSpacesOrder] = useState<Space[]>([]);

  // Keep local order in sync with context
  useEffect(() => {
    setSpacesOrder(spaces as Space[]);
  }, [spaces]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<{spaceId: string, currentGroup: string} | null>(null);
  const [editingSpace, setEditingSpace] = useState<{id: string, name: string} | null>(null);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newSpaceName, setNewSpaceName] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<{type: 'space' | 'group', id?: string, group?: string} | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<{type: 'space' | 'group', id?: string, group?: string} | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<{group: string} | null>(null);
  
  // Close dropdown when clicking outside
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update local state when spaces prop changes
  useEffect(() => {
    setSpacesOrder(spaces);
  }, [spaces]);

  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    // Only start dragging if we're not clicking on a dropdown or its button
    if (!(e.target as HTMLElement).closest('.dropdown-menu') && 
        !(e.target as HTMLElement).closest('.dropdown-toggle')) {
      setDraggedIndex(index);
      // Close any open dropdown when starting to drag
      setActiveDropdown(null);
    }
  };

  const handleMouseEnter = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleGroupDragEnter = (groupName: string) => {
    if (draggedIndex !== null) {
      setDragOverGroup(groupName);
      setDragOverIndex(null);
    }
  };

  const handleMouseUp = async () => {
    if (draggedIndex === null) return;
    
    const newOrder = [...spacesOrder];
    const draggedSpace = newOrder[draggedIndex];

    // Move between groups
    if (dragOverGroup !== null && draggedSpace.group !== dragOverGroup) {
      console.log(`Moving space from ${draggedSpace.group} to ${dragOverGroup}`);
      await addOrUpdateGroup(draggedSpace.id, dragOverGroup);
      const updatedSpace = { ...draggedSpace, group: dragOverGroup };
      newOrder[draggedIndex] = updatedSpace;
      setSpacesOrder(newOrder);
    }
    // Reorder within same group
    else if (dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(dragOverIndex, 0, removed);
      setSpacesOrder(newOrder);
      // Optionally, you can implement order update in context if needed
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragOverGroup(null);
  };

  useEffect(() => {
    if (draggedIndex !== null) {
      // Add global mouse up handler to catch mouse up events outside the list
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedIndex, dragOverIndex, dragOverGroup, spacesOrder]);

  // Group spaces by their group property
  const groupedSpaces = spacesOrder.reduce<Record<string, Space[]>>((groups, space) => {
    const group = space.group || 'Default';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(space);
    return groups;
  }, {});

  // Sort group names alphabetically
  const sortedGroupNames = Object.keys(groupedSpaces).sort();

  const handleGroupEdit = (spaceId: string, currentGroup: string) => {
    setEditingGroup({ spaceId, currentGroup });
    setNewGroupName(currentGroup);
  };

  const handleGroupNameEdit = (groupName: string) => {
    setEditingGroupName({ group: groupName });
    setNewGroupName(groupName);
  };

  const handleGroupUpdate = async (spaceId: string) => {
    if (editingGroup && newGroupName.trim()) {
      await addOrUpdateGroup(spaceId, newGroupName.trim());
      setEditingGroup(null);
    }
  };

  const handleGroupNameUpdate = async () => {
    if (editingGroupName && newGroupName.trim()) {
      // Get all spaces in this group
      const spacesInGroup = spacesOrder.filter(space => space.group === editingGroupName.group);
      
      // Update the group name for all spaces in the group
      for (const space of spacesInGroup) {
        await addOrUpdateGroup(space.id, newGroupName.trim());
      }
      
      setEditingGroupName(null);
    }
  };
  
  const handleSpaceEdit = (id: string, name: string) => {
    setEditingSpace({ id, name });
    setNewSpaceName(name);
  };

  const handleSpaceUpdate = async () => {
    if (editingSpace && newSpaceName.trim()) {
      await addOrUpdateSpace({ ...spacesOrder.find(s => s.id === editingSpace.id)!, name: newSpaceName.trim() });
      setEditingSpace(null);
    }
  };
  
  const handleSpaceDelete = async (id: string) => {
    await deleteSpace(id);
    setConfirmDelete(null);
    
    // If the deleted space was selected, deselect it
    if (selectedSpace && selectedSpace.id === id) {
      const nextSpace = spacesOrder.find(space => space.id !== id);
      if (nextSpace) {
        onSelectSpace(nextSpace);
      }
    }
  };
  
  const handleGroupDelete = async (groupName: string) => {
    // Get all spaces in this group
    const spacesInGroup = spacesOrder.filter(space => space.group === groupName);
    
    // Delete all spaces in the group
    for (const space of spacesInGroup) {
      await deleteSpace(space.id);
    }
    await deleteGroup(groupName);
    
    setConfirmDelete(null);
  };

  const handleDropOnGroup = async (e: React.DragEvent<HTMLUListElement>, groupName: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const idx = spacesOrder.findIndex(space => space.id === id);
    if (idx < 0) return;
    const draggedSpace = spacesOrder[idx];
    if (draggedSpace.group === groupName) return;
    // removed updateSpaceGroup, now using addOrUpdateGroup or deleteGroup from context
//id, groupName);
    // update local state
    const newOrder = [...spacesOrder];
    newOrder[idx] = { ...draggedSpace, group: groupName };
    setSpacesOrder(newOrder);
  };

  return (
    <div className="flex-1 overflow-visible" ref={dropdownRef}>
      {sortedGroupNames.map((groupName) => (
        <div 
          key={groupName} 
          className={`mb-4 ${dragOverGroup === groupName ? 'group-drag-over' : ''}`}
          onMouseEnter={() => handleGroupDragEnter(groupName)}
        >
          <div className="group-header bg-red-900 bg-opacity-20 px-3 py-2 rounded-t-md font-semibold text-sm text-red-400 flex justify-between items-center">
            <span>{groupName}</span>
            <div className="relative">
              <button 
                className="text-xs text-red-400 hover:text-red-300 dropdown-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDropdown(prev => 
                    prev?.type === 'group' && prev.group === groupName 
                      ? null 
                      : { type: 'group', group: groupName }
                  );
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {activeDropdown?.type === 'group' && activeDropdown.group === groupName && (
                <div className="dropdown-menu absolute right-0 mt-1 w-40 bg-gray-800 rounded-md shadow-lg z-20 py-1" style={{ bottom: 'auto', top: '100%' }}>
                  <button 
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupNameEdit(groupName);
                      setActiveDropdown(null);
                    }}
                  >
                    Edit Group Name
                  </button>
                  <button 
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                    onClick={() => setConfirmDelete({ type: 'group', group: groupName })}
                  >
                    Delete Group
                  </button>
                </div>
              )}
            </div>
          </div>
          <ul
            className="space-y-1 mb-2 border-l-2 border-r-2 border-b-2 border-red-900 border-opacity-20 rounded-b-md"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDropOnGroup(e, groupName)}
          >
            {groupedSpaces[groupName].map((space, index) => {
              const globalIndex = spacesOrder.findIndex(s => s.id === space.id);
              return (
                <li
                  draggable
                  onDragStart={e => e.dataTransfer.setData('text/plain', space.id)}
                  key={space.id}
                  onMouseDown={(e) => handleMouseDown(globalIndex, e)}
                  onMouseEnter={() => handleMouseEnter(globalIndex)}
                  onClick={(e) => {
                    // Only select the space if we're not clicking on the dropdown
                    if (!(e.target as HTMLElement).closest('.dropdown-menu') && 
                        !(e.target as HTMLElement).closest('.dropdown-toggle')) {
                      onSelectSpace(space);
                    }
                  }}
                  className={`space-item p-3 cursor-pointer hover:bg-red-900 hover:bg-opacity-10 ${selectedSpace?.id === space.id ? 'bg-red-900 bg-opacity-15' : ''} ${
                    draggedIndex === globalIndex ? 'dragging opacity-50' : ''
                  } ${dragOverIndex === globalIndex ? 'drag-over' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="mr-2 text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm3 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-medium">{space.name}</span>
                    </div>
                    <div className="relative">
                      <button 
                        className="text-xs text-red-400 hover:text-red-300 dropdown-toggle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(prev => 
                            prev?.type === 'space' && prev.id === space.id 
                              ? null 
                              : { type: 'space', id: space.id }
                          );
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                      
                      {activeDropdown?.type === 'space' && activeDropdown.id === space.id && (
                        <div className="dropdown-menu absolute right-0 mt-1 w-40 bg-gray-800 rounded-md shadow-lg z-20 py-1" style={{ bottom: 'auto', top: '100%' }}>
                          <button 
                            className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSpaceEdit(space.id, space.name);
                              setActiveDropdown(null);
                            }}
                          >
                            Edit Name
                          </button>
                          <button 
                            className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGroupEdit(space.id, space.group);
                              setActiveDropdown(null);
                            }}
                          >
                            Change Group
                          </button>
                          <button 
                            className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete({ type: 'space', id: space.id });
                              setActiveDropdown(null);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Group editing modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-[400px] max-w-[90%] shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">Change Space Group</h3>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full p-2 mb-4 bg-gray-700 text-white rounded border border-gray-600 focus:border-red-500 focus:outline-none"
              placeholder="Group name"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingGroup(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleGroupUpdate(editingGroup.spaceId)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Group Name editing modal */}
      {editingGroupName && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-[400px] max-w-[90%] shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">Edit Group Name</h3>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full p-2 mb-4 bg-gray-700 text-white rounded border border-gray-600 focus:border-red-500 focus:outline-none"
              placeholder="Group name"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingGroupName(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleGroupNameUpdate}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Space editing modal */}
      {editingSpace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-[400px] max-w-[90%] shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">Edit Space</h3>
            <input
              type="text"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              className="w-full p-2 mb-4 bg-gray-700 text-white rounded border border-gray-600 focus:border-red-500 focus:outline-none"
              placeholder="Space name"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingSpace(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSpaceUpdate}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirmation dialog for deletion */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-[400px] max-w-[90%] shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">
              {confirmDelete.type === 'space' ? 'Delete Space' : 'Delete Group'}
            </h3>
            <p className="text-white mb-6">
              {confirmDelete.type === 'space' 
                ? 'Are you sure you want to delete this space? This will also delete all topics within it.'
                : `Are you sure you want to delete the group "${confirmDelete.group}"? This will delete all spaces and topics within it.`
              }
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'space' && confirmDelete.id) {
                    handleSpaceDelete(confirmDelete.id);
                  } else if (confirmDelete.type === 'group' && confirmDelete.group) {
                    handleGroupDelete(confirmDelete.group);
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpacesList;
