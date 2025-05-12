import { db as firestoreDb } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  DocumentData
} from 'firebase/firestore';

export interface Space {
  id: string;
  name: string;
  order: number;
  group: string;
}

export interface Topic {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  posX: number;
  posY: number;
}

// Collection references for Firestore
const spacesCollection = collection(firestoreDb, 'spaces');
const topicsCollection = collection(firestoreDb, 'topics');

// Helper functions for database operations
export async function getSpaces(): Promise<Space[]> {
  try {
    const firestoreSpacesQuery = query(spacesCollection, orderBy('order'));
    const firestoreSpacesSnapshot = await getDocs(firestoreSpacesQuery);
    
    const spaces: Space[] = [];
    firestoreSpacesSnapshot.forEach((docSnapshot) => {
      const spaceData = docSnapshot.data() as Space;
      spaces.push(spaceData);
    });
    
    return spaces;
  } catch (error) {
    console.error('Error retrieving spaces:', error);
    return [];
  }
}

export async function addSpace(name: string, group: string = 'Default'): Promise<string> {
  try {
    // Get the highest order number from existing spaces
    const spaces = await getSpaces();
    const maxOrder = spaces.length > 0 
      ? Math.max(...spaces.map(space => space.order)) 
      : -1;
    
    const id = Date.now().toString();
    const newSpace = {
      id,
      name,
      group,
      order: maxOrder + 1
    };
    
    // Add to Firestore
    await setDoc(doc(spacesCollection, id), newSpace);
    
    return id;
  } catch (error) {
    console.error('Error adding space:', error);
    throw error;
  }
}

export async function updateSpaceOrder(spaces: Space[]): Promise<void> {
  try {
    // Update each space's order in Firestore
    for (let i = 0; i < spaces.length; i++) {
      await updateDoc(doc(spacesCollection, spaces[i].id), { order: i });
    }
  } catch (error) {
    console.error('Error updating space order:', error);
    throw error;
  }
}

export async function getTopics(spaceId: string): Promise<Topic[]> {
  try {
    const firestoreTopicsQuery = query(topicsCollection, where('spaceId', '==', spaceId));
    const firestoreTopicsSnapshot = await getDocs(firestoreTopicsQuery);
    
    const topics: Topic[] = [];
    firestoreTopicsSnapshot.forEach((docSnapshot) => {
      const topicData = docSnapshot.data() as Topic;
      topics.push(topicData);
    });
    
    return topics;
  } catch (error) {
    console.error('Error retrieving topics:', error);
    return [];
  }
}

export async function addTopic(spaceId: string, title: string, content: string = '', posX: number = 50, posY: number = 50): Promise<string> {
  try {
    const id = Date.now().toString();
    const newTopic = {
      id,
      spaceId,
      title,
      content,
      posX,
      posY
    };
    
    // Add to Firestore
    await setDoc(doc(topicsCollection, id), newTopic);
    
    return id;
  } catch (error) {
    console.error('Error adding topic:', error);
    throw error;
  }
}

export async function updateTopicPosition(id: string, posX: number, posY: number): Promise<void> {
  try {
    // Update in Firestore
    await updateDoc(doc(topicsCollection, id), { posX, posY });
  } catch (error) {
    console.error('Error updating topic position:', error);
    throw error;
  }
}

export async function updateTopicContent(id: string, content: string): Promise<void> {
  try {
    // Update in Firestore
    await updateDoc(doc(topicsCollection, id), { content });
  } catch (error) {
    console.error('Error updating topic content:', error);
    throw error;
  }
}

// Function to update space group
export async function updateSpaceGroup(id: string, group: string): Promise<void> {
  try {
    // Update in Firestore
    await updateDoc(doc(spacesCollection, id), { group });
  } catch (error) {
    console.error('Error updating space group:', error);
    throw error;
  }
}

// Function to update space name
export async function updateSpaceName(id: string, name: string): Promise<void> {
  try {
    // Update in Firestore
    await updateDoc(doc(spacesCollection, id), { name });
  } catch (error) {
    console.error('Error updating space name:', error);
    throw error;
  }
}

// Function to delete a space
export async function deleteSpace(id: string): Promise<void> {
  try {
    // First, get all topics in this space
    const topicsInSpace = await getTopics(id);
    
    // Delete all topics in the space
    for (const topic of topicsInSpace) {
      await deleteDoc(doc(topicsCollection, topic.id));
    }
    
    // Delete the space
    await deleteDoc(doc(spacesCollection, id));
  } catch (error) {
    console.error('Error deleting space:', error);
    throw error;
  }
}

// For compatibility with previous import in other files
export const db = { spaces: {}, topics: {} };
