export interface Categories {
    killCount: string[]
    collectionLog: string[]
    matchmaking: MatchmakingCategory
}

interface MatchmakingCategory {
    threeSeven: string[]
    duo: string[]
    combined: string[]
}