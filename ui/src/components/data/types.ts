export interface DataTableColumn {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  /** extra classes for the header and cells, e.g. `max-sm:hidden` */
  class?: string
}
