export interface StockMetadata {
  id: string;
  filename: string;
  originalFilename?: string;
  title: string;
  description: string;
  keywords: string;
  rating?: number;
  status: 'pending' | 'generating' | 'completed' | 'error' | 'saving' | 'saved' | 'retrying';
  fileType: string;
  previewUrl?: string;
  handle?: any; // FileSystemFileHandle
  analysis?: {
    theme: string;
    subject: string;
    objects: string[];
    colors: string[];
    concepts: string[];
  };
  category?: string;
  kwCount?: number;
  keywordScore?: number;
  errorMessage?: string;
}

export interface ApiConfig {
  gemini: string[];
  groq: string[];
  mistral: string[];
}

export type ApiConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed';

export interface ApiStatus {
  [key: string]: ApiConnectionStatus;
}

export type StockMarketplace = 
  | 'universal'
  | 'adobe'
  | 'shutterstock'
  | 'freepik'
  | 'getty'
  | 'vecteezy'
  | 'pond5'
  | 'envato'
  | 'depositphotos'
  | '123rf'
  | 'dreamstime'
  | 'alamy'
  | 'canva'
  | 'motionelements'
  | 'creativemarket';

export interface GeneratorSettings {
  titleLength: [number, number];
  descriptionLength: [number, number];
  keywordsCount: number;
  autoDownload: boolean;
  promptMode: 'default' | 'adobe' | 'shutterstock' | 'custom' | 'freepik' | 'getty';
  marketplace: StockMarketplace;
  aiModel: string;
  titlePrefix: string;
  titleSuffix: string;
  keywordsPrefix: string;
  keywordsSuffix: string;
  customPrompt: string;
  optimizeKeywords: boolean;
  minTitleWords: number;
  maxTitleWords: number;
  minDescriptionWords: number;
  maxDescriptionWords: number;
  minKeywords: number;
  maxKeywords: number;
  titleChoice: number;
  metadataFor: 'image' | 'video' | 'eps' | 'png' | 'all';
  concurrency: number;
  singleWordKeywords: boolean;
  silhouette: boolean;
  transparentBackground: boolean;
  prohibitedWords: boolean;
  customPromptEnabled: boolean;
  autoGenerateOnAdd: boolean;
  savedKeywords: string[];
  autoSyncFilenameWithTitle?: boolean;
  filenameFormat?: 'exact_title' | 'kebab_case' | 'snake_case';
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  files: StockMetadata[];
}
