function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function words(value: string) {
  return normalize(value).match(/[a-z0-9]+/g) ?? [];
}

function editDistance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current.push(Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + Number(left[leftIndex - 1] !== right[rightIndex - 1]),
      ));
    }
    previous = current;
  }

  return previous[right.length];
}

function scoreWord(queryWord: string, candidateWord: string) {
  if (candidateWord === queryWord) return 100;
  if (candidateWord.startsWith(queryWord)) return 80;
  if (candidateWord.includes(queryWord)) return 65;
  if (queryWord.length < 3 || candidateWord.length < 3) return 0;

  const allowedDistance = queryWord.length >= 5 ? 2 : 1;
  if (Math.abs(candidateWord.length - queryWord.length) > allowedDistance) return 0;

  const distance = editDistance(queryWord, candidateWord);
  return distance <= allowedDistance ? 45 - distance * 10 : 0;
}

/**
 * Matches every query word against the searchable text, then ranks the
 * results so exact and prefix matches appear before forgiving typo matches.
 */
export function fuzzySearch<T>(items: T[], query: string, getSearchText: (item: T) => string): T[] {
  const queryWords = words(query);
  if (queryWords.length === 0) return items;

  return items
    .map((item, index) => {
      const candidateWords = words(getSearchText(item));
      let score = 0;

      for (const queryWord of queryWords) {
        const bestWordScore = candidateWords.reduce(
          (bestScore, candidateWord) => Math.max(bestScore, scoreWord(queryWord, candidateWord)),
          0,
        );
        if (bestWordScore === 0) return null;
        score += bestWordScore;
      }

      return { item, index, score };
    })
    .filter((result): result is { item: T; index: number; score: number } => result !== null)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}
