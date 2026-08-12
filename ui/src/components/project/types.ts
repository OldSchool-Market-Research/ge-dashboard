export interface KanbanCardData {
  id: string
  title: string
  tags?: string[]
  assignee?: string
  priority?: 'low' | 'medium' | 'high'
}

export interface KanbanColumnData {
  id: string
  title: string
  cards: KanbanCardData[]
}
