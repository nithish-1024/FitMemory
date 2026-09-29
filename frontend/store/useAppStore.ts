import { create } from "zustand";
import {
  FeedbackLogEntry,
  MemoryViewerResponse,
  RecommendationResponse,
  WardrobeItem,
} from "@/lib/api";
import { DEFAULT_WARDROBES } from "@/lib/default-wardrobes";

export type UserType = "arjun" | "sara";

export interface LoadingFlags {
  wardrobe: boolean;
  recommend: boolean;
  feedback: boolean;
  memory: boolean;
}

export interface AppState {
  // Current user
  currentUser: UserType;
  setUser: (user: UserType) => void;

  // Wardrobe data
  wardrobe: WardrobeItem[];
  setWardrobe: (items: WardrobeItem[]) => void;

  // Current recommended outfit
  currentOutfit: RecommendationResponse | null;
  setCurrentOutfit: (outfit: RecommendationResponse | null) => void;

  // Persistent memory data
  memoryData: MemoryViewerResponse | null;
  setMemoryData: (data: MemoryViewerResponse | null) => void;

  // Feedback interaction log
  feedbackLog: FeedbackLogEntry[];
  setFeedbackLog: (log: FeedbackLogEntry[]) => void;

  // Loading state flags
  loading: LoadingFlags;
  setLoading: (key: keyof LoadingFlags, value: boolean) => void;

  // Exclude list (for consecutive recommendation generation)
  exclude: string[];
  addExclude: (itemIds: string[]) => void;
  clearExclude: () => void;

  // Wardrobe entrance status
  hasEnteredWardrobe: boolean;
  setHasEnteredWardrobe: (entered: boolean) => void;

  // Selected item for detail inspection
  selectedItem: WardrobeItem | null;
  setSelectedItem: (item: WardrobeItem | null) => void;

  // Reset all state (e.g. when switching users)
  resetStore: () => void;
}

const initialLoadingFlags: LoadingFlags = {
  wardrobe: false,
  recommend: false,
  feedback: false,
  memory: false,
};

export const useAppStore = create<AppState>((set) => ({
  currentUser: "arjun",
  setUser: (user: UserType) =>
    set((state) => ({
      currentUser: user,
      currentOutfit: null,
      exclude: [],
      memoryData: null,
      feedbackLog: [],
      wardrobe: DEFAULT_WARDROBES[user] || [],
      selectedItem: null,
      hasEnteredWardrobe: state.hasEnteredWardrobe,
    })),

  wardrobe: DEFAULT_WARDROBES.arjun,
  setWardrobe: (wardrobe) => set({ wardrobe }),

  currentOutfit: null,
  setCurrentOutfit: (currentOutfit) => set({ currentOutfit }),

  memoryData: null,
  setMemoryData: (memoryData) => set({ memoryData }),

  feedbackLog: [],
  setFeedbackLog: (feedbackLog) => set({ feedbackLog }),

  loading: initialLoadingFlags,
  setLoading: (key, value) =>
    set((state) => ({
      loading: {
        ...state.loading,
        [key]: value,
      },
    })),

  exclude: [],
  addExclude: (itemIds) =>
    set((state) => ({
      exclude: Array.from(new Set([...state.exclude, ...itemIds])),
    })),
  clearExclude: () => set({ exclude: [] }),

  hasEnteredWardrobe: false,
  setHasEnteredWardrobe: (hasEnteredWardrobe) => set({ hasEnteredWardrobe }),

  selectedItem: null,
  setSelectedItem: (selectedItem) => set({ selectedItem }),

  resetStore: () =>
    set({
      currentOutfit: null,
      exclude: [],
      memoryData: null,
      feedbackLog: [],
      wardrobe: [],
      hasEnteredWardrobe: false,
      selectedItem: null,
      loading: initialLoadingFlags,
    }),
}));
