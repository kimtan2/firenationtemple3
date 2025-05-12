import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

// Types unified with db.ts
import type { Space, Topic as Subject } from '../lib/db';

type SpacesContextType = {
  spaces: Space[];
  spacesLoading: boolean;
  subjectsBySpace: { [spaceId: string]: Subject[] };
  subjectsLoading: { [spaceId: string]: boolean };
  fetchSubjectsForSpace: (spaceId: string) => Promise<void>;
  addOrUpdateSpace: (space: Space) => Promise<void>;
  deleteSpace: (spaceId: string) => Promise<void>;
  addOrUpdateGroup: (spaceId: string, groupName: string) => Promise<void>;
  deleteGroup: (groupName: string) => Promise<void>;
  addOrUpdateSubject: (spaceId: string, subject: Subject) => Promise<void>;
  deleteSubject: (spaceId: string, subjectId: string) => Promise<void>;
};

const SpacesContext = createContext<SpacesContextType | undefined>(undefined);

export const useSpacesContext = () => {
  const ctx = useContext(SpacesContext);
  if (!ctx) throw new Error("useSpacesContext must be used within SpacesProvider");
  return ctx;
};

export const SpacesProvider = ({ children }: { children: ReactNode }) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spacesLoading, setSpacesLoading] = useState<boolean>(true);
  const [subjectsBySpace, setSubjectsBySpace] = useState<{ [spaceId: string]: Subject[] }>({});
  const [subjectsLoading, setSubjectsLoading] = useState<{ [spaceId: string]: boolean }>({});

  // Fetch all spaces once on mount
  useEffect(() => {
    const fetchSpaces = async () => {
      setSpacesLoading(true);
      const spacesData: Space[] = await (await import('../lib/db')).getSpaces();
      setSpaces(spacesData);
      setSpacesLoading(false);
    };
    fetchSpaces();
  }, []);

  // Fetch subjects for a space (on demand)
  const fetchSubjectsForSpace = async (spaceId: string) => {
    if (subjectsBySpace[spaceId]) return; // Already loaded
    setSubjectsLoading(prev => ({ ...prev, [spaceId]: true }));
    const subjectsSnap = await getDocs(collection(db, `spaces/${spaceId}/subjects`));
    const subjects = subjectsSnap.docs.map(s => ({ id: s.id, ...s.data() })) as Subject[];
    setSubjectsBySpace(prev => ({ ...prev, [spaceId]: subjects }));
    setSubjectsLoading(prev => ({ ...prev, [spaceId]: false }));
  };

  // Add or update a space
  const addOrUpdateSpace = async (space: Space) => {
    await setDoc(doc(db, "spaces", space.id), { ...space });
    setSpaces(prev => {
      const idx = prev.findIndex(s => s.id === space.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...space };
        return updated;
      } else {
        return [...prev, space];
      }
    });
  };

  // Delete a space
  const deleteSpace = async (spaceId: string) => {
    await deleteDoc(doc(db, "spaces", spaceId));
    setSpaces(prev => prev.filter(s => s.id !== spaceId));
    setSubjectsBySpace(prev => {
      const copy = { ...prev };
      delete copy[spaceId];
      return copy;
    });
  };

  // Add or update a group (update the group property of a space)
  const addOrUpdateGroup = async (spaceId: string, groupName: string) => {
    await updateDoc(doc(db, "spaces", spaceId), { group: groupName });
    setSpaces(prev => prev.map(s =>
      s.id === spaceId ? { ...s, group: groupName } : s
    ));
  };

  // Delete a group (remove the group from all spaces with that group)
  const deleteGroup = async (groupName: string) => {
    // Remove group from all spaces with this group
    setSpaces(prev => prev.map(s =>
      s.group === groupName ? { ...s, group: "" } : s
    ));
    // Optionally, update Firestore for all such spaces
    const spacesToUpdate = spaces.filter(s => s.group === groupName);
    for (const space of spacesToUpdate) {
      await updateDoc(doc(db, "spaces", space.id), { group: "" });
    }
  };

  // Add or update a subject in a space
  const addOrUpdateSubject = async (spaceId: string, subject: Subject) => {
    await setDoc(doc(db, `spaces/${spaceId}/subjects`, subject.id), { ...subject });
    setSubjectsBySpace(prev => {
      const list = prev[spaceId] || [];
      const idx = list.findIndex(s => s.id === subject.id);
      const updated = idx !== -1
        ? [...list.slice(0, idx), { ...subject }, ...list.slice(idx + 1)]
        : [...list, subject];
      return { ...prev, [spaceId]: updated };
    });
  };

  // Delete a subject in a space
  const deleteSubject = async (spaceId: string, subjectId: string) => {
    await deleteDoc(doc(db, `spaces/${spaceId}/subjects`, subjectId));
    setSubjectsBySpace(prev => {
      const list = prev[spaceId] || [];
      return { ...prev, [spaceId]: list.filter(s => s.id !== subjectId) };
    });
  };

  return (
    <SpacesContext.Provider value={{
      spaces,
      spacesLoading,
      subjectsBySpace,
      subjectsLoading,
      fetchSubjectsForSpace,
      addOrUpdateSpace,
      deleteSpace,
      addOrUpdateGroup,
      deleteGroup,
      addOrUpdateSubject,
      deleteSubject,
    }}>
      {children}
    </SpacesContext.Provider>
  );
};
