import {appendIconComponentCache} from '@opensearch-project/oui/es/components/icon/icon'

import {icon as ouiSearch} from '@opensearch-project/oui/es/components/icon/assets/search'
import {icon as ouiDot} from '@opensearch-project/oui/es/components/icon/assets/dot'
import {icon as ouiArrowDown} from '@opensearch-project/oui/es/components/icon/assets/arrow_down'
import {icon as ouiArrowLeft} from '@opensearch-project/oui/es/components/icon/assets/arrow_left'
import {icon as ouiArrowRight} from '@opensearch-project/oui/es/components/icon/assets/arrow_right'
import {icon as ouiSortUp} from '@opensearch-project/oui/es/components/icon/assets/sort_up'
import {icon as ouiSortDown} from '@opensearch-project/oui/es/components/icon/assets/sort_down'
import {icon as ouiCross} from '@opensearch-project/oui/es/components/icon/assets/cross'
import {icon as ouiGrab} from '@opensearch-project/oui/es/components/icon/assets/grab'
import {icon as ouiExpandMini} from '@opensearch-project/oui/es/components/icon/assets/expandMini'
import {icon as ouiListAdd} from '@opensearch-project/oui/es/components/icon/assets/list_add'
import {icon as ouiSortable} from '@opensearch-project/oui/es/components/icon/assets/sortable'

import {icon as ouiSortLeft} from '@opensearch-project/oui/es/components/icon/assets/sortLeft'
import {icon as ouiSortRight} from '@opensearch-project/oui/es/components/icon/assets/sortRight'
import {icon as ouiEyeClosed} from '@opensearch-project/oui/es/components/icon/assets/eye_closed'
import {icon as ouiTokenDate} from '@opensearch-project/oui/es/components/icon/assets/tokens/tokenDate'
import {icon as ouiTokenString} from '@opensearch-project/oui/es/components/icon/assets/tokens/tokenString'
import {icon as ouiTokenNumber} from '@opensearch-project/oui/es/components/icon/assets/tokens/tokenNumber'
import {icon as ouiCheck} from '@opensearch-project/oui/es/components/icon/assets/check'
import {icon as ouiEmpty} from '@opensearch-project/oui/es/components/icon/assets/empty'
import {icon as kqlValue} from '@opensearch-project/oui/es/components/icon/assets/kql_value'
import {icon as kqlOperand} from '@opensearch-project/oui/es/components/icon/assets/kql_operand'
import {icon as kqlField} from '@opensearch-project/oui/es/components/icon/assets/kql_field'
import {icon as kqlSelector} from '@opensearch-project/oui/es/components/icon/assets/kql_selector'
import {icon as lineChart} from '@opensearch-project/oui/es/components/icon/assets/lineChart' 

appendIconComponentCache({
  search: ouiSearch,
  dot: ouiDot,
  arrowDown: ouiArrowDown,
  arrowLeft: ouiArrowLeft,
  arrowRight: ouiArrowRight,
  sortUp: ouiSortUp,
  sortDown: ouiSortDown,
  cross: ouiCross,
  grab: ouiGrab,
  expandMini: ouiExpandMini,
  listAdd: ouiListAdd,
  sortable: ouiSortable,
  sortLeft: ouiSortLeft,
  sortRight: ouiSortRight,
  eyeClosed: ouiEyeClosed,
  tokenDate: ouiTokenDate,
  tokenString: ouiTokenString,
  tokenNumber: ouiTokenNumber,
  check: ouiCheck,
  empty: ouiEmpty,
  kqlValue: kqlValue,
  kqlOperand: kqlOperand,
  kqlField: kqlField,
  kqlSelector: kqlSelector,
  lineChart: lineChart
})
