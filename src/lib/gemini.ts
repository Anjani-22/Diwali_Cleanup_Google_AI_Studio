import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface AnalyzedListingResult {
  title: string;
  category: string;
  brand: string;
  condition: 'new' | 'almost' | 'used';
  suggestedPriceMin: number;
  suggestedPriceMax: number;
  expiryDate: string;
  description: string;
  usageNotes: string;
}

const VALID_CATEGORIES = [
  'Home Decor',
  'Electronics',
  'Clothing & Textiles',
  'Personal Care',
  'Books & Stationery',
  'Kitchenware',
  'Furniture',
  'Packaged Pantry',
];

export async function analyzeListingImage(
  base64Data: string,
  mimeType: string
): Promise<AnalyzedListingResult> {
  const cleanBase64 = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        },
        {
          text:
            'Analyze this household item photo for an Indian neighborhood resale, sharing, and donation marketplace (Diwali CleanUp). ' +
            'Identify the item clearly, suggest a realistic Indian Rupee (INR) resale price range if sellable, ' +
            'perform OCR to extract any visible expiry or best-before date in YYYY-MM-DD format (return empty string if none visible), ' +
            'assess physical condition (new, almost, or used), and write helpful usage/benefit notes.',
        },
      ],
    },
    config: {
      systemInstruction:
        'You are a careful product catalog assistant for an Indian household decluttering marketplace. ' +
        `Choose category strictly from: ${VALID_CATEGORIES.join(', ')}. ` +
        'Keep title concise (4-8 words). Keep description natural and factual in 2 sentences. Prices must be realistic INR integers.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          category: { type: Type.STRING },
          brand: { type: Type.STRING },
          condition: { type: Type.STRING },
          suggestedPriceMin: { type: Type.INTEGER },
          suggestedPriceMax: { type: Type.INTEGER },
          expiryDate: { type: Type.STRING },
          description: { type: Type.STRING },
          usageNotes: { type: Type.STRING },
        },
        required: [
          'title',
          'category',
          'brand',
          'condition',
          'suggestedPriceMin',
          'suggestedPriceMax',
          'expiryDate',
          'description',
          'usageNotes',
        ],
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as Partial<AnalyzedListingResult>;

  const normalizedCategory = VALID_CATEGORIES.includes(parsed.category ?? '')
    ? (parsed.category as string)
    : 'Home Decor';

  const normalizedCondition: 'new' | 'almost' | 'used' =
    parsed.condition === 'new' ||
    parsed.condition === 'almost' ||
    parsed.condition === 'used'
      ? parsed.condition
      : 'almost';

  const minPrice = Math.max(0, Math.round(Number(parsed.suggestedPriceMin) || 0));
  const maxPrice = Math.max(minPrice, Math.round(Number(parsed.suggestedPriceMax) || minPrice));

  return {
    title: (parsed.title || 'Household Item').slice(0, 100),
    category: normalizedCategory,
    brand: parsed.brand?.trim() || 'Unbranded',
    condition: normalizedCondition,
    suggestedPriceMin: minPrice,
    suggestedPriceMax: maxPrice,
    expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.expiryDate || '')
      ? (parsed.expiryDate as string)
      : '',
    description: parsed.description?.trim() || 'Well-kept household item available locally.',
    usageNotes: parsed.usageNotes?.trim() || '',
  };
}
