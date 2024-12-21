export function normalizeVariantCombinations(combinations: any): string {
  if (typeof combinations === 'string') {
    try {
      // Validate it's a valid JSON string
      JSON.parse(combinations);
      return combinations;
    } catch {
      return '[]';
    }
  }
  
  if (Array.isArray(combinations)) {
    return JSON.stringify(combinations);
  }
  
  return '[]';
}

export function parseVariantCombinations(combinations: string | null | undefined): any[] {
  if (!combinations) return [];
  
  try {
    const parsed = JSON.parse(combinations);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
