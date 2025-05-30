import {appendIconComponentCache} from '@opensearch-project/oui/es/components/icon/icon'

import {icon as ouiSearch} from '@opensearch-project/oui/es/components/icon/assets/search'
import {icon as ouiDot} from '@opensearch-project/oui/es/components/icon/assets/dot'
import {icon as ouiArrowDown} from '@opensearch-project/oui/es/components/icon/assets/arrow_down'
import {icon as ouiArrowLeft} from '@opensearch-project/oui/es/components/icon/assets/arrow_left'
import {icon as ouiArrowRight} from '@opensearch-project/oui/es/components/icon/assets/arrow_right'

import {icon as ouiSortUp} from '@opensearch-project/oui/es/components/icon/assets/sort_up'
import {icon as ouiSortDown} from '@opensearch-project/oui/es/components/icon/assets/sort_down'

appendIconComponentCache({
  search: ouiSearch,
  dot: ouiDot,
  arrowDown: ouiArrowDown,
  arrowLeft: ouiArrowLeft,
  arrowRight: ouiArrowRight,
  sortUp: ouiSortUp,
  sortDown: ouiSortDown,
})
